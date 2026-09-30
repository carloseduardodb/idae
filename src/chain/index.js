// =============================================================================
// chain/index.js — IDAE com cadeia de 4 intenções (porte fiel do Exp-C1):
// IntentionStore, ValidatorStore (telos imutável), ProgramStore (programa
// descartável por intenção), Negotiator (Fase 1 TTL=3, Fase 2 TTL=2) e
// CompressionEngine (suspensão/reativação). Executa em processo, sem HTTP.
// =============================================================================

import { chat } from '../llm-client.js';
import { cleanCode, compile } from '../util.js';

export class SystemicInconsistencyError extends Error {
  constructor(id, phase) { super(`intention ${id} phase ${phase}`); this.intentionId = id; this.phase = phase; }
}

export const INTENTIONS = {
  1: `Normalize raw input into a transaction record with:
- transaction_id: non-empty string
- amount: positive number
- currency: string (3-letter code OR full name)
- timestamp: string in any parseable date format`,
  2: `Enrich normalized transaction with:
- transaction_id: non-empty string
- amount_usd: positive number (converted to USD: BRL/5, EUR*1.1, GBP*1.27, USD*1)
- currency_original: original currency string
- timestamp_iso: ISO 8601 string
- category: "domestic" if BRL, "international" otherwise`,
  3: `Aggregate enriched transaction for reporting:
- id: non-empty string
- value: positive number (in USD)
- date: string in YYYY-MM-DD format (UTC calendar date)
- category: "domestic" or "international"
- risk_flag: "low" if value < 1000, "medium" if < 5000, "high" otherwise`,
  4: `Final audit record (IMMUTABLE TELOS):
- audit_id: non-empty string
- value_in_usd: positive number
- date: string in DD/MM/YYYY format (UTC calendar date)
- category: "domestic" or "international"
- status: "valid" if value > 0 and date parseable, "invalid" otherwise`,
};

export const VALIDATORS = {
  1: (o) => !!o && typeof o.transaction_id === 'string' && !!o.transaction_id.trim() && typeof o.amount === 'number' && o.amount > 0
    && typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency) && typeof o.timestamp === 'string' && !isNaN(Date.parse(o.timestamp)),
  2: (o) => !!o && typeof o.transaction_id === 'string' && !!o.transaction_id.trim() && typeof o.amount_usd === 'number' && o.amount_usd > 0
    && typeof o.currency_original === 'string' && typeof o.timestamp_iso === 'string' && (o.category === 'domestic' || o.category === 'international'),
  3: (o) => !!o && typeof o.id === 'string' && !!o.id.trim() && typeof o.value === 'number' && o.value > 0
    && typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.date) && (o.category === 'domestic' || o.category === 'international')
    && ['low', 'medium', 'high'].includes(o.risk_flag),
  4: (o) => !!o && typeof o.audit_id === 'string' && !!o.audit_id.trim() && typeof o.value_in_usd === 'number' && o.value_in_usd > 0
    && typeof o.date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(o.date) && (o.category === 'domestic' || o.category === 'international')
    && (o.status === 'valid' || o.status === 'invalid'),
};

const PHASE1_TTL = 3, PHASE2_TTL = 2;

export class ChainIDAE {
  constructor({ model, llm } = {}) {
    this.model = model; this.llm = llm;
    this.chain = ['1', '2', '3', '4'];
    this.state = Object.fromEntries(this.chain.map(id => [id, 'active']));
    this.validators = Object.fromEntries(this.chain.map(id => [id, { fn: VALIDATORS[id], immutable: id === '4', reconstructions: 0 }]));
    this.programs = {};
    this.stats = { llmCalls: 0, promptChars: 0, responseChars: 0, llmMs: 0, programsGenerated: {}, validatorReconstructions: {},
      adaptations: 0, compressions: {}, reactivations: 0, chainPaths: {}, systemicErrors: 0, telosFailures: 0 };
  }

  async #ask(prompt) {
    const t0 = Date.now();
    this.stats.llmCalls++; this.stats.promptChars += prompt.length;
    const text = await (this.llm || chat)(prompt, { model: this.model });
    this.stats.responseChars += text.length; this.stats.llmMs += Date.now() - t0;
    return text;
  }

  #validate(id, o) { try { return !!this.validators[id].fn(o); } catch { return false; } }

  async #synthProgram(id, sample) {
    const prompt = `You are a code generator. Write ONLY the body of a JavaScript function that receives a single parameter called "entry" (a raw data string or object) and returns a normalized object.

The intention for this step:
${INTENTIONS[id]}

The FINAL intention of the entire pipeline (the ultimate goal):
${INTENTIONS['4']}

Sample entries the function must handle:
${JSON.stringify(sample)}

CRITICAL RULES:
- Return ONLY the function body code. No function declaration, no markdown, no explanation.
- The parameter is called "entry". It may be a string or an object.
- Parse/transform "entry" and return the normalized object matching the intention fields.
- Numbers must be actual numbers (not strings).
- Do NOT use require() or import.`;
    this.stats.programsGenerated[id] = (this.stats.programsGenerated[id] || 0) + 1;
    return compile(cleanCode(await this.#ask(prompt)));
  }

  async #reconstructValidator(id, sample) {
    const prompt = `You are a code generator. Write ONLY the body of a JavaScript function that receives a single parameter called "output" (an object) and returns true if valid, false otherwise.

CONTEXT: The original validator for this intention became unsatisfiable because:
Data format changed. Sample: ${JSON.stringify(sample)}. Original validator unsatisfiable.

This intention (whose validator needs reconstruction):
${INTENTIONS[id]}

The FINAL intention (IMMUTABLE anchor — the ultimate goal of the pipeline):
${INTENTIONS['4']}

The NEW validator must:
1. Be MORE FLEXIBLE than the original — accept equivalent representations
2. Still ensure the output can eventually be transformed to feed the final intention
3. Accept currency as full names, abbreviations, or ISO codes
4. Accept dates/timestamps in any parseable format
5. Ensure id fields are non-empty strings
6. Ensure amount/value fields are positive numbers

CRITICAL RULES:
- Return ONLY the function body code. No function declaration, no markdown, no explanation.
- The parameter is called "output". Return true or false.
- Do NOT use require() or import.`;
    const body = cleanCode(await this.#ask(prompt))
      .replace(/^(?:function\s*\w*\s*\(\s*output\s*\)\s*\{)([\s\S]*)\}\s*$/, '$1');
    const f = compile(`return (function(output){\n${body}\n})(entry);`);
    return (o) => f(o);
  }

  async #resolve(id, input) {
    if (this.programs[id]) {
      try { const out = this.programs[id](input); if (this.#validate(id, out)) return out; } catch {}
      this.programs[id] = null;
      this.stats.adaptations++;
    }
    for (let a = 1; a <= PHASE1_TTL; a++) {
      try {
        const fn = await this.#synthProgram(id, input);
        const out = fn(input);
        if (this.#validate(id, out)) { this.programs[id] = fn; return out; }
      } catch {}
    }
    if (this.validators[id].immutable) throw new SystemicInconsistencyError(id, 1);
    for (let a = 1; a <= PHASE2_TTL; a++) {
      try {
        const vfn = await this.#reconstructValidator(id, input);
        this.validators[id].fn = vfn;
        this.validators[id].reconstructions++;
        const fn = await this.#synthProgram(id, input);
        const out = fn(input);
        if (this.#validate(id, out)) {
          this.programs[id] = fn;
          this.stats.validatorReconstructions[id] = (this.stats.validatorReconstructions[id] || 0) + 1;
          return out;
        }
      } catch {}
    }
    throw new SystemicInconsistencyError(id, 2);
  }

  #compress(raw, out1) {
    let parsed = raw;
    try { parsed = JSON.parse(raw); } catch {}
    let best = -1;
    for (let i = this.chain.length - 2; i >= 1; i--) {
      if (parsed && typeof parsed === 'object' && this.#validate(this.chain[i], parsed)) { best = i; break; }
    }
    const setState = (id, st) => {
      if (this.state[id] === st) return;
      this.state[id] = st;
      if (st === 'suspended') this.stats.compressions[id] = (this.stats.compressions[id] || 0) + 1;
      else this.stats.reactivations++;
    };
    for (let i = 1; i < this.chain.length - 1; i++) setState(this.chain[i], best > 0 && i <= best ? 'suspended' : 'active');
    const path = this.chain.filter(id => this.state[id] === 'active').map(Number);
    return { path, feed: best > 0 ? parsed : out1 };
  }

  async process(raw) {
    try {
      const out1 = await this.#resolve('1', raw);
      const { path, feed } = this.#compress(raw, out1);
      let cur = feed;
      for (const id of this.chain) {
        if (id === '1' || this.state[id] !== 'active') continue;
        cur = await this.#resolve(id, typeof cur === 'string' ? cur : JSON.stringify(cur));
      }
      if (!VALIDATORS['4'](cur)) { this.stats.telosFailures++; return { accepted: false, reason: 'telos' }; }
      const key = JSON.stringify(path);
      this.stats.chainPaths[key] = (this.stats.chainPaths[key] || 0) + 1;
      return { accepted: true, output: cur, path };
    } catch (e) {
      if (e instanceof SystemicInconsistencyError) { this.stats.systemicErrors++; return { accepted: false, reason: `systemic:${e.intentionId}/F${e.phase}` }; }
      return { accepted: false, reason: 'error:' + e.message };
    }
  }
}
