// =============================================================================
// E7 — Deriva gradual (reavaliação do Exp-C3 Parte C) e validator
// mal-especificado (Parte B).
//
// Parte C: formato financeiro da Fase 1; uma fração crescente dos registros
// (5, 20, 50, 80%) chega SEM moeda — a decisão correta é rejeitá-los. Mede se
// o sistema "adivinha" a moeda (corrupção) e o custo em chamadas.
//
// Parte B: validator permissivo (não exige valor > 0): mede quantos valores
// negativos/zero passam — a garantia do IDAE é exatamente a do validator.
// =============================================================================

import { domain as FIN, validator as finValidator } from '../src/domains/financial.js';
import { IDAE, LLMDirect } from '../src/approaches/index.js';
import { runStream, save, printTable } from '../src/harness.js';
import { rng } from '../src/util.js';

const N = parseInt(process.env.N || '100');
const RATES = { BRL: 0.2, USD: 1, EUR: 1.1, GBP: 1.27 };
const CURS = ['BRL', 'USD', 'EUR', 'GBP'];
const pad = (n, w = 2) => String(n).padStart(w, '0');

function driftStream(rate, seed) {
  const r = rng(seed), s = [];
  for (let i = 0; i < N; i++) {
    const cur = CURS[i % 4], amount = r.range(10, 5000);
    const d = new Date(Date.UTC(2024, r.int(0, 11), r.int(1, 28), r.int(0, 23), r.int(0, 59)));
    const has = r() >= rate, id = `DRIFT${pad(i, 4)}`;
    const raw = JSON.stringify({ transaction_id: id, amount, ...(has ? { currency: cur } : {}), timestamp: d.toISOString().replace('.000', '') });
    const truth = has ? { expect: 'accept', output: {
      audit_id: id, value_in_usd: Math.round(amount * RATES[cur] * 100) / 100,
      date: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
      category: cur === 'BRL' ? 'domestic' : 'international', status: 'valid' } } : { expect: 'reject' };
    s.push({ phase: `drift-${Math.round(rate * 100)}`, idx: i, raw, truth, kind: has ? 'com-moeda' : 'sem-moeda' });
  }
  return s;
}

const ONLY_B = process.env.PART === 'B';
const partC = {};
const REPS = parseInt(process.env.REPS || '3');
if (!ONLY_B) await Promise.all([0.05, 0.2, 0.5, 0.8].map(async (rate, k) => {
  const jobs = [];
  for (let rep = 0; rep < REPS; rep++) {
    const s = driftStream(rate, 3001 + k + 10 * rep);
    jobs.push(runStream(new IDAE(FIN, { name: `IDAE (original) #${rep + 1}` }), FIN, s));
    jobs.push(runStream(new IDAE(FIN, { name: `IDAE + rejeição explícita #${rep + 1}`, explicitReject: true }), FIN, s));
    if (rep === 0) jobs.push(runStream(new LLMDirect(FIN), FIN, s, { concurrency: 5 }));
  }
  const runs = await Promise.all(jobs);
  partC[rate] = runs;
  printTable(`E7-C — deriva ${rate * 100}% sem moeda`, runs);
}));

// Parte B — validator mal-especificado (aceita valor <= 0).
// Telos mal-especificado: a especificação não exige valor positivo nem traz a
// regra de rejeição, e o validator também não checa o sinal.
const MIS_SPEC = FIN.SPEC.replace('positive number — the transaction amount', 'number — the transaction amount').split('Rejection rule:')[0];
const permissive = { ...FIN, name: 'financeiro-permissivo', SPEC: MIS_SPEC, validator: (o) => finValidator({ ...o, value_in_usd: o && typeof o.value_in_usd === 'number' ? Math.abs(o.value_in_usd) || 1 : o?.value_in_usd }) };
const r = rng(3101), sB = [];
for (let i = 0; i < 30; i++) {
  const kind = ['valido', 'negativo', 'zero'][i % 3]; // válido primeiro: o programa é aprendido num caso válido
  const amount = kind === 'negativo' ? -r.range(10, 5000) : kind === 'zero' ? 0 : r.range(10, 5000);
  const id = `MIS${pad(i, 4)}`;
  const raw = JSON.stringify({ transaction_id: id, amount, currency: 'USD', timestamp: '2024-06-15T10:00:00Z' });
  const truth = kind === 'valido' ? { expect: 'accept', output: { audit_id: id, value_in_usd: amount, date: '15/06/2024', category: 'international', status: 'valid' } } : { expect: 'reject' };
  sB.push({ phase: 'B', idx: i, raw, truth, kind });
}
const partB = await Promise.all([
  runStream(new IDAE(permissive, { name: 'IDAE telos permissivo' }), permissive, sB),
  runStream(new IDAE(FIN, { name: 'IDAE telos correto' }), FIN, sB),
  runStream(new IDAE(permissive, { name: 'IDAE telos permissivo (Haiku 4.5)', model: 'claude-haiku-4.5' }), permissive, sB),
  runStream(new IDAE(FIN, { name: 'IDAE telos correto (Haiku 4.5)', model: 'claude-haiku-4.5' }), FIN, sB),
]);
printTable('E7-B — validator mal-especificado', partB);
for (const x of partB) console.log(x.approach, JSON.stringify(Object.fromEntries(Object.entries(x.perKind).map(([k, t]) => [k, { correct: t.correct, corrupt: t.corrupt, rej: t.correctReject, fr: t.falseReject }]))));

console.log('arquivo:', ONLY_B ? save('e7b-telos-mal-especificado.json', { partB }) : save('e7-deriva.json', { N, partC, partB }));
