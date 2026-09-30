// =============================================================================
// approaches/index.js — Abordagens comparadas, todas com a MESMA especificação
// (SPEC do domínio) e o MESMO modelo, avaliadas pelo MESMO oráculo.
//
//   IDAE            síntese de programa + validator do telos como portão +
//                   amortização + TTL + marcação de formato esgotado
//                   (reimplementação fiel do runner dos Exps. 2/5 originais).
//                   Opções para ablação: validator, amortização, rejeição
//                   explícita, N-version (k=2).
//   LLMDirect       LLM transforma CADA registro diretamente (sem validator).
//   LLMValRetry     LLM por registro + validator + retry (TTL=3), sem amortização.
//   SchemaBased     parser determinístico escrito para o formato da Fase 1.
// =============================================================================

import { chat } from '../llm-client.js';
import { cleanCode, compile, parseJsonReply, formatSignature } from '../util.js';
import { compareOutput } from '../metrics.js';

function newStats() { return { llmCalls: 0, promptChars: 0, responseChars: 0, llmMs: 0, syntheses: 0, programsActivated: 0, disagreements: 0, llmErrors: 0 }; }

async function ask(stats, prompt, { model, llm } = {}) {
  const t0 = Date.now();
  stats.llmCalls++;
  stats.promptChars += prompt.length;
  try {
    const text = await (llm || chat)(prompt, { model });
    stats.responseChars += text.length;
    stats.llmMs += Date.now() - t0;
    return text;
  } catch (e) {
    stats.llmErrors++;
    throw e;
  }
}

export function synthesisPrompt(spec, samples, variant = 1) {
  return `You are a code generator. Write ONLY the body of a JavaScript function that receives a single parameter called "entry" (a raw input string) and returns the target record described below — or returns null if the record must be rejected.

${spec}

Sample input(s) — the function must handle inputs in this same format:
${samples.map(s => s.length > 1500 ? s.slice(0, 1500) : s).join('\n')}
${variant > 1 ? `\nThis is independent implementation #${variant}: write your own solution from scratch.\n` : ''}
CRITICAL RULES:
- Return ONLY the function body code. No function declaration, no markdown, no explanation.
- The parameter is called "entry" and is a string.
- Numbers must be actual numbers (not strings).
- Do NOT use require() or import.`;
}

export function directPrompt(spec, raw) {
  return `Convert the input record below into the target record.

${spec}

Input record:
${raw}

Respond with ONLY the JSON object of the target record, or with the literal null if the record must be rejected. No markdown, no explanation.`;
}

// ---------------------------------------------------------------------------
// IDAE
// ---------------------------------------------------------------------------
export class IDAE {
  constructor(domain, {
    name = 'IDAE', validator = 'format', amortize = true, ttl = 3, nversion = 1,
    explicitReject = false, model, llm, onAttempt,
  } = {}) {
    this.domain = domain;
    this.name = name;
    this.opts = { validator, amortize, ttl, nversion, explicitReject, model, llm };
    this.onAttempt = onAttempt;  // gancho para medir H_r por tentativa
    this.stats = newStats();
    this.store = new Map();      // ProgramStore: assinatura de formato -> [k programas]
    this.exhausted = new Set();  // assinaturas que esgotaram o TTL
    this.hrTrace = [];           // tentativas até convergência (ou TTL) por síntese
  }

  #valid(o, raw) {
    const v = this.opts.validator;
    if (v === 'none') return !!o && typeof o === 'object' && !Array.isArray(o);
    if (v === 'grounded') return this.domain.groundedValidator(o, raw);
    return this.domain.validator(o);
  }

  #run(fn, raw) { try { return fn(raw); } catch { return undefined; } }

  // Executa os programas de uma assinatura: 'ok' | 'reject' | 'disagree' | 'fail'
  #apply(progs, raw) {
    const outs = progs.map(fn => this.#run(fn, raw));
    if (this.opts.explicitReject && outs.every(o => o === null)) return { st: 'reject' };
    if (!outs.every(o => this.#valid(o, raw))) return { st: 'fail' };
    for (let k = 1; k < outs.length; k++) {
      if (compareOutput(outs[k], outs[0], this.domain.tolerances).length) return { st: 'disagree' };
    }
    return { st: 'ok', output: outs[0] };
  }

  async #synthesizeOne(raw, variant) {
    for (let attempt = 1; attempt <= this.opts.ttl; attempt++) {
      this.stats.syntheses++;
      let fn = null, out;
      try {
        const text = await ask(this.stats, synthesisPrompt(this.domain.SPEC, [raw], variant), { model: this.opts.model, llm: this.opts.llm });
        fn = compile(cleanCode(text));
        out = this.#run(fn, raw);
      } catch { fn = null; }
      const valid = !!fn && this.#valid(out, raw);
      this.onAttempt?.({ raw, attempt, variant, out, valid });
      if (valid) return { fn, out, attempts: attempt };
      if (fn && out === null && this.opts.explicitReject) return { reject: true, fn, attempts: attempt };
    }
    return { fn: null, attempts: this.opts.ttl };
  }

  async process(raw) {
    const sig = formatSignature(raw);
    if (this.opts.amortize && this.store.has(sig)) {
      const r = this.#apply(this.store.get(sig), raw);
      if (r.st === 'ok') return { accepted: true, output: r.output };
      if (r.st === 'reject') return { accepted: false, reason: 'explicit-reject' };
      if (r.st === 'disagree') { this.stats.disagreements++; return { accepted: false, reason: 'nversion-disagree' }; }
      // O programa vigente não satisfaz o telos: é descartado (artefato descartável).
      this.store.delete(sig);
    }
    if (this.opts.amortize && this.exhausted.has(sig)) return { accepted: false, reason: 'format-exhausted' };

    const progs = [];
    let firstOut = null;
    for (let v = 1; v <= this.opts.nversion; v++) {
      const s = await this.#synthesizeOne(raw, v);
      this.hrTrace.push({ attempts: s.attempts, converged: !!s.fn });
      if (s.reject) {
        // A rejeição também é amortizada: o programa que rejeita fica ativo para
        // o formato, evitando nova amostragem do LLM a cada registro inválido.
        if (this.opts.amortize && this.opts.nversion === 1) { this.store.set(sig, [s.fn]); this.exhausted.delete(sig); }
        return { accepted: false, reason: 'explicit-reject-at-synthesis' };
      }
      if (!s.fn) { if (this.opts.amortize) this.exhausted.add(sig); return { accepted: false, reason: 'ttl-exhausted' }; }
      if (v > 1 && compareOutput(s.out, firstOut, this.domain.tolerances).length) {
        this.stats.disagreements++;
        return { accepted: false, reason: 'nversion-disagree-at-synthesis' };
      }
      if (v === 1) firstOut = s.out;
      progs.push(s.fn);
    }
    if (this.opts.amortize) { this.store.set(sig, progs); this.exhausted.delete(sig); }
    this.stats.programsActivated++;
    return { accepted: true, output: firstOut };
  }
}

// ---------------------------------------------------------------------------
// LLM-Direct (por registro, sem validator)
// ---------------------------------------------------------------------------
export class LLMDirect {
  constructor(domain, { name = 'LLM-Direct', model, llm } = {}) {
    this.domain = domain; this.name = name; this.model = model; this.llm = llm; this.stats = newStats();
  }
  async process(raw) {
    try {
      const out = parseJsonReply(await ask(this.stats, directPrompt(this.domain.SPEC, raw), { model: this.model, llm: this.llm }));
      if (out && typeof out === 'object' && !Array.isArray(out)) return { accepted: true, output: out };
      return { accepted: false, reason: 'model-reject' };
    } catch { return { accepted: false, reason: 'unparseable' }; }
  }
}

// ---------------------------------------------------------------------------
// LLM + Validator + Retry (por registro)
// ---------------------------------------------------------------------------
export class LLMValRetry {
  constructor(domain, { name = 'LLM+Val+Retry', ttl = 3, model, llm } = {}) {
    this.domain = domain; this.name = name; this.ttl = ttl; this.model = model; this.llm = llm; this.stats = newStats();
  }
  async process(raw) {
    for (let a = 1; a <= this.ttl; a++) {
      try {
        const out = parseJsonReply(await ask(this.stats, directPrompt(this.domain.SPEC, raw), { model: this.model, llm: this.llm }));
        if (out === null) return { accepted: false, reason: 'model-reject' };
        if (this.domain.validator(out)) return { accepted: true, output: out };
      } catch {}
    }
    return { accepted: false, reason: 'ttl-exhausted' };
  }
}

// ---------------------------------------------------------------------------
// Schema-Based: parser estático escrito à mão para o formato da Fase 1.
// ---------------------------------------------------------------------------
export class SchemaBased {
  constructor(domain) { this.domain = domain; this.name = 'Schema-Based'; this.stats = newStats(); }
  process(raw) {
    let o;
    try { o = JSON.parse(raw); } catch { return { accepted: false, reason: 'no-parser' }; }
    if (this.domain.name === 'financeiro') {
      const R = { BRL: 0.2, USD: 1, EUR: 1.1, GBP: 1.27 };
      if (!('transaction_id' in o && 'amount' in o && 'currency' in o && 'timestamp' in o)) return { accepted: false, reason: 'no-parser' };
      if (typeof o.amount !== 'number' || o.amount <= 0 || !R[o.currency]) return { accepted: false, reason: 'rule' };
      const d = new Date(o.timestamp);
      if (isNaN(d)) return { accepted: false, reason: 'rule' };
      const p = (n) => String(n).padStart(2, '0');
      return { accepted: true, output: {
        audit_id: o.transaction_id, value_in_usd: Math.round(o.amount * R[o.currency] * 100) / 100,
        date: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
        category: o.currency === 'BRL' ? 'domestic' : 'international', status: 'valid',
      } };
    }
    if (this.domain.name === 'iot') {
      if (!('device_id' in o && 'metric' in o && 'value' in o && 'unit' in o && 'timestamp' in o && 'zone' in o)) return { accepted: false, reason: 'no-parser' };
      const out = { device_id: o.device_id, metric: o.metric, value: o.value, timestamp_utc: o.timestamp, zone: o.zone };
      if (typeof o.value !== 'number') return { accepted: false, reason: 'rule' };
      const v = o.value, m = o.metric;
      out.status = m === 'temperature' ? (v > 40 || v < -5 ? 'critical' : v > 30 || v < 0 ? 'warning' : 'normal')
        : m === 'humidity' ? (v > 90 ? 'critical' : v > 75 ? 'warning' : 'normal')
        : (v < 960 || v > 1040 ? 'critical' : v < 980 || v > 1030 ? 'warning' : 'normal');
      return this.domain.validator(out) ? { accepted: true, output: out } : { accepted: false, reason: 'rule' };
    }
    return { accepted: false, reason: 'no-parser' };
  }
}
