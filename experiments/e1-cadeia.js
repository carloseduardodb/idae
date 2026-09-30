// =============================================================================
// E1 — Cadeia de 4 intenções com compressão e Fase 2 (reavaliação do Exp-C1)
//
// Mesmas 5 fases do C1 (JSON limpo, pré-enriquecido, pipe informal,
// pré-agregado, CSV informal), agora com verdade-terreno do telos final.
// Diferente do C1 original, o fluxo NÃO para na primeira falha: toda
// decisão é registrada e comparada ao oráculo.
// =============================================================================

import { ChainIDAE } from '../src/chain/index.js';
import { rng } from '../src/util.js';
import { runStream, save, printTable } from '../src/harness.js';

const N = parseInt(process.env.N || '200');
const SEED = parseInt(process.env.SEED || '101');
const RATES = { BRL: 0.2, USD: 1, EUR: 1.1, GBP: 1.27 };
const CURS = ['BRL', 'USD', 'EUR', 'GBP'];
const FULL = { BRL: 'Reais', USD: 'US Dollar', EUR: 'Euro', GBP: 'Pound Sterling' };
const INF = { BRL: 'real', USD: 'dolar', EUR: 'euro', GBP: 'libra' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (n, w = 2) => String(n).padStart(w, '0');
const r2 = (x) => Math.round(x * 100) / 100;
const ddmm = (d) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const truth = (id, usd, d, cur) => ({ expect: 'accept', output: { audit_id: id, value_in_usd: r2(usd), date: ddmm(d), category: cur === 'BRL' ? 'domestic' : 'international', status: 'valid' } });

const domain = { name: 'financeiro-cadeia', tolerances: { value_in_usd: 0.011 }, phases: [
  // P1 — JSON limpo, horários em todo o dia (UTC). Caminho esperado [1,2,3,4].
  { id: 'P1', gen: (i, r) => {
    const cur = CURS[i % 4], a = r.range(10, 5000), d = new Date(Date.UTC(2024, r.int(0, 11), r.int(1, 28), r.int(0, 23), r.int(0, 59)));
    const id = `TX${pad(i, 4)}`;
    return { raw: JSON.stringify({ transaction_id: id, amount: a, currency: cur, timestamp: d.toISOString().replace('.000', '') }), truth: truth(id, a * RATES[cur], d, cur) };
  } },
  // P2 — Pré-enriquecido: satisfaz o validator da intenção 2 → esperado [1,3,4].
  { id: 'P2', gen: (i, r) => {
    const cur = CURS[i % 4], usd = r.range(10, 5000), d = new Date(Date.UTC(2024, r.int(0, 11), r.int(1, 28), r.int(0, 23), r.int(0, 59)));
    const id = `EN${pad(i + 1000, 4)}`;
    return { raw: JSON.stringify({ transaction_id: id, amount_usd: usd, currency_original: cur, timestamp_iso: d.toISOString(), category: cur === 'BRL' ? 'domestic' : 'international' }), truth: truth(id, usd, d, cur) };
  } },
  // P3 — Pipe com moeda por extenso: o validator 1 exige código ISO, a descrição aceita nome → gatilho da Fase 2.
  { id: 'P3', gen: (i, r) => {
    const cur = CURS[i % 4], a = r.range(10, 5000), mo = r.int(0, 11), dd = r.int(1, 28), d = new Date(Date.UTC(2024, mo, dd));
    const id = `PP${pad(i + 2000, 4)}`;
    return { raw: `${id}|${a}|${FULL[cur]}|${dd} ${MON[mo]} 2024`, truth: truth(id, a * RATES[cur], d, cur) };
  } },
  // P4 — Pré-agregado: satisfaz o validator da intenção 3 → esperado [1,4].
  { id: 'P4', gen: (i, r) => {
    const cur = CURS[i % 4], usd = r.range(10, 5000), d = new Date(Date.UTC(2024, r.int(0, 11), r.int(1, 28)));
    const id = `AG${pad(i + 3000, 4)}`;
    return { raw: JSON.stringify({ id, value: usd, currency: cur, date: d.toISOString().slice(0, 10), category: cur === 'BRL' ? 'domestic' : 'international', risk_flag: usd < 1000 ? 'low' : usd < 5000 ? 'medium' : 'high' }), truth: truth(id, usd, d, cur) };
  } },
  // P5 — CSV informal em português → reativação [1,2,3,4].
  { id: 'P5', gen: (i, r) => {
    const cur = CURS[i % 4], a = r.range(10, 5000), mo = r.int(0, 11), dd = r.int(1, 28), d = new Date(Date.UTC(2024, mo, dd));
    const id = `CS${pad(i + 4000, 4)}`;
    return { raw: `${id},${a},${INF[cur]},${MES[mo]}-${dd}-2024`, truth: truth(id, a * RATES[cur], d, cur) };
  } },
] };

const r = rng(SEED);
const stream = [];
for (const ph of domain.phases) for (let i = 0; i < N; i++) { const g = ph.gen(i, r); stream.push({ phase: ph.id, idx: i, raw: g.raw, truth: g.truth }); }

const chain = new ChainIDAE();
chain.name = 'IDAE-cadeia (4 intenções)';
const pathsPerPhase = {};
const res = await runStream(chain, domain, stream, {
  onDecision: (e, d) => {
    pathsPerPhase[e.phase] ??= {};
    const k = d.path ? JSON.stringify(d.path) : `rejeitado:${d.reason}`;
    pathsPerPhase[e.phase][k] = (pathsPerPhase[e.phase][k] || 0) + 1;
  },
});
printTable('E1 — cadeia', [res]);
for (const [p, t] of Object.entries(res.perPhase)) console.log(p, `correto ${t.correct}/${t.n}`, 'corrupção', t.corrupt, 'campos', JSON.stringify(t.fieldErrors), 'caminhos', JSON.stringify(pathsPerPhase[p]));
console.log('stats', JSON.stringify({ ...chain.stats, validatorReconstructions: chain.stats.validatorReconstructions }));
console.log('arquivo:', save('e1-cadeia.json', { N, SEED, result: res, pathsPerPhase }));
