// =============================================================================
// harness.js — Construção de fluxos com verdade-terreno, execução de uma
// abordagem sobre o fluxo e persistência de resultados.
// =============================================================================

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rng, pool } from './util.js';
import { emptyTally, tally, merge, rates } from './metrics.js';
import { MODEL } from './llm-client.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RESULTS = join(ROOT, 'results');

// Fluxo sintético: fases em sequência, n registros por fase (nAdv na adversarial).
export function buildStream(domain, { seed, n = 100, nAdv = 50 }) {
  const r = rng(seed);
  const stream = [];
  for (const ph of domain.phases) {
    const count = ph.adversarial ? nAdv : n;
    for (let i = 0; i < count; i++) {
      const g = ph.gen(i, r);
      stream.push({ phase: ph.id, idx: i, raw: g.raw, truth: g.truth, kind: g.kind || null });
    }
  }
  return stream;
}

// Subamostra estável: primeiros k de cada fase (kAdv na adversarial).
export function subsample(stream, k, kAdv = k) {
  const count = {};
  return stream.filter(e => {
    const lim = e.phase === 'P6' ? kAdv : k;
    count[e.phase] = (count[e.phase] || 0) + 1;
    return count[e.phase] <= lim;
  });
}

// Executa a abordagem sobre o fluxo. Abordagens com estado (IDAE) rodam em
// sequência; abordagens por registro podem rodar em paralelo.
export async function runStream(approach, domain, stream, { concurrency = 1, onDecision } = {}) {
  const t0 = Date.now();
  const decide = async (e) => {
    let d;
    try { d = await approach.process(e.raw); } catch (err) { d = { accepted: false, reason: 'error:' + err.message }; }
    return d;
  };
  const decisions = concurrency > 1 ? await pool(stream, concurrency, decide) : [];
  if (concurrency <= 1) for (const e of stream) decisions.push(await decide(e));

  const perPhase = {}, perKind = {};
  const records = [];
  let total = emptyTally();
  stream.forEach((e, i) => {
    const d = decisions[i];
    perPhase[e.phase] ??= emptyTally();
    const c = tally(perPhase[e.phase], d, e.truth, domain.tolerances);
    if (e.kind) { perKind[e.kind] ??= emptyTally(); tally(perKind[e.kind], d, e.truth, domain.tolerances); }
    records.push({ phase: e.phase, idx: e.idx, kind: e.kind, cls: c.cls, wrong: c.wrong || [], reason: d.reason || null, output: d.output ?? null });
    onDecision?.(e, d, c);
  });
  for (const t of Object.values(perPhase)) total = merge(total, t);
  return {
    approach: approach.name, domain: domain.name, n: stream.length,
    total, totalRates: rates(total),
    perPhase: Object.fromEntries(Object.entries(perPhase).map(([k, t]) => [k, { ...t, rates: rates(t) }])),
    perKind: Object.fromEntries(Object.entries(perKind).map(([k, t]) => [k, { ...t, rates: rates(t) }])),
    stats: { ...approach.stats, estTokens: Math.round((approach.stats.promptChars + approach.stats.responseChars) / 4) },
    hrTrace: approach.hrTrace || null,
    wallMs: Date.now() - t0,
    records,
  };
}

export function save(name, data) {
  mkdirSync(RESULTS, { recursive: true });
  const file = join(RESULTS, name);
  writeFileSync(file, JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), tz: process.env.TZ || null, ...data }, null, 2));
  return file;
}

export const pct = (x) => (100 * x).toFixed(1) + '%';

export function printTable(title, results) {
  console.log(`\n=== ${title} ===`);
  console.log('abordagem'.padEnd(34) + 'n'.padStart(5) + '  correto  corrupção  rej.corr  rej.falsa  chamadas  tokens~');
  for (const r of results) {
    const t = r.total;
    console.log(
      r.approach.padEnd(34) + String(t.n).padStart(5) +
      pct(t.correct / t.n).padStart(9) + pct(t.corrupt / t.n).padStart(11) +
      String(t.correctReject).padStart(10) + String(t.falseReject).padStart(11) +
      String(r.stats.llmCalls).padStart(10) + String(r.stats.estTokens).padStart(9),
    );
  }
}
