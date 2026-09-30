// =============================================================================
// report.js — Consolida resultados de results/*.json em results/RESUMO.md
// e executa as análises estatísticas (E5) e de H_r/TTL (E6).
// =============================================================================

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RESULTS } from '../src/harness.js';
import { mean, sd, wilson, wilcoxonExact, mcnemarExact, cliffsDelta } from '../src/stats.js';

const load = (f) => existsSync(join(RESULTS, f)) ? JSON.parse(readFileSync(join(RESULTS, f), 'utf8')) : null;
const P = (x) => (100 * x).toFixed(1);
const L = [];
const w = (s = '') => L.push(s);
const row = (r, sub) => {
  const t = sub || r.total;
  const ci = wilson(t.corrupt, t.n);
  return `| ${r.approach} | ${t.n} | ${P(t.correct / t.n)} | ${P(t.corrupt / t.n)} [${P(ci.lo)}–${P(ci.hi)}] | ${t.correctReject}/${t.shouldReject} | ${t.falseReject} | ${sub ? '—' : r.stats.llmCalls} | ${sub ? '—' : r.stats.estTokens} |`;
};
const HEAD = '| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |\n|---|---|---|---|---|---|---|---|';

function subTally(r, keep) {
  const t = { n: 0, correct: 0, corrupt: 0, correctReject: 0, falseReject: 0, shouldReject: 0 };
  for (const x of r.records) if (keep(x)) {
    t.n++; t[x.cls]++;
    if (x.cls === 'correctReject' || x.cls === 'corrupt' && x.wrong.includes('<should-reject>')) t.shouldReject++;
  }
  return t;
}

// ---------------- E1 ----------------
const e1 = load('e1-cadeia.json');
if (e1) {
  const r = e1.result;
  w('## E1 — Cadeia de 4 intenções (compressão + Fase 2)\n');
  w(HEAD); w(row(r)); w();
  w('| Fase | Correto | Corrupção | Campos errados | Caminhos |\n|---|---|---|---|---|');
  for (const [p, t] of Object.entries(r.perPhase)) w(`| ${p} | ${t.correct}/${t.n} | ${t.corrupt} | ${JSON.stringify(t.fieldErrors)} | ${JSON.stringify(e1.pathsPerPhase[p])} |`);
  const s = r.stats;
  w(`\nChamadas LLM: ${s.llmCalls}; programas gerados: ${JSON.stringify(s.programsGenerated)}; reconstruções de validator: ${JSON.stringify(s.validatorReconstructions)}; compressões: ${JSON.stringify(s.compressions)}; reativações: ${s.reactivations}; erros sistêmicos: ${s.systemicErrors}.\n`);
}

// ---------------- E2 ----------------
for (const f of ['e2-baselines-claude-opus-4.5.json', 'e2-baselines-claude-haiku-4.5.json']) {
  const e2 = load(f);
  if (!e2) continue;
  w(`## E2 — Baselines (${e2.model})\n`);
  for (const [dom, R] of Object.entries(e2.results)) {
    const inSub = (x) => x.phase === 'P6' || x.idx < e2.SUB;
    w(`### ${dom} — fluxo completo (Schema-Based, IDAE)\n`); w(HEAD); w(row(R.schema)); w(row(R.idae)); w();
    w(`### ${dom} — subamostra pareada (${e2.SUB}/fase + ${e2.NADV} adversariais)\n`); w(HEAD);
    w(row(R.schema, subTally(R.schema, inSub))); w(row(R.idae, subTally(R.idae, inSub))); w(row(R.direct)); w(row(R.retry)); w();
    w('Por fase (correto/n, corrupção):\n');
    w('| Abordagem | ' + Object.keys(R.idae.perPhase).join(' | ') + ' |'); w('|---|' + Object.keys(R.idae.perPhase).map(() => '---').join('|') + '|');
    for (const x of [R.schema, R.idae, R.direct, R.retry]) w(`| ${x.approach} | ` + Object.values(x.perPhase).map(t => `${t.correct}/${t.n} (${t.corrupt})`).join(' | ') + ' |');
    w('\nFase adversarial por variante (IDAE | LLM-Direct | LLM+Val+Retry):\n');
    for (const k of Object.keys(R.idae.perKind)) {
      const f3 = (x) => { const t = x.perKind[k]; return t ? `ok ${t.correct} corr ${t.corrupt} rej ${t.correctReject} fr ${t.falseReject}` : '—'; };
      w(`- ${k}: ${f3(R.idae)} | ${f3(R.direct)} | ${f3(R.retry)}`);
    }
    // McNemar pareado na subamostra: acerto (correct|correctReject) IDAE vs LLM-Direct
    const key = (x) => `${x.phase}#${x.idx}`;
    const good = (x) => x.cls === 'correct' || x.cls === 'correctReject';
    const dm = new Map(R.direct.records.map(x => [key(x), good(x)]));
    let b = 0, c = 0;
    for (const x of R.idae.records.filter(inSub)) { const d = dm.get(key(x)); if (d === undefined) continue; if (good(x) && !d) b++; if (!good(x) && d) c++; }
    const m = mcnemarExact(b, c);
    w(`\nMcNemar exato (decisão correta, IDAE vs LLM-Direct, subamostra): só IDAE acerta=${b}, só LLM-Direct acerta=${c}, p=${m.p.toPrecision(3)}\n`);
    w(`Erros por campo — IDAE: ${JSON.stringify(R.idae.total.fieldErrors)}; LLM-Direct: ${JSON.stringify(R.direct.total.fieldErrors)}; LLM+Val+Retry: ${JSON.stringify(R.retry.total.fieldErrors)}\n`);
  }
}

// ---------------- E3 ----------------
const e3 = load('e3-usgs.json');
if (e3) {
  w('## E3 — USGS (560 eventos reais)\n'); w(HEAD);
  for (const r of e3.results) w(row(r));
  w('\n| Abordagem | ' + ['P1', 'P2', 'P3', 'P4', 'P5'].join(' | ') + ' | erros por campo |\n|---|---|---|---|---|---|---|');
  for (const r of e3.results) w(`| ${r.approach} | ` + Object.values(r.perPhase).map(t => `${t.correct}/${t.n}`).join(' | ') + ` | ${JSON.stringify(r.total.fieldErrors)} |`);
  w('\nTelos original — fabricação:\n'); w('```json\n' + JSON.stringify(e3.fabrication, null, 1) + '\n```\n');
}

// ---------------- E4 + E6 ----------------
const e4 = load('e4-ablacao.json');
if (e4) {
  w('## E4 — Ablação\n');
  for (const [dom, R] of Object.entries(e4.results)) {
    w(`### ${dom}\n`); w(HEAD);
    for (const r of R.runs) w(row(r));
    w('\nAdversarial por variante (ok/corrupção/rej.corr/rej.falsa):\n');
    for (const r of R.runs) w(`- ${r.approach}: ` + Object.entries(r.perKind).map(([k, t]) => `${k}=${t.correct}/${t.corrupt}/${t.correctReject}/${t.falseReject}`).join('; '));
    w();
  }
}

const e5 = load('e5-repeticoes.json');
// E6 — H_r (oráculo) por tentativa e sensibilidade de TTL, a partir dos traços de E4/E5.
const seqs = []; // sequências de tentativas, cada uma de uma única instância de IDAE
if (e4) for (const [dom, R] of Object.entries(e4.results)) for (const [name, arr] of Object.entries(R.hr)) seqs.push(arr.map(a => ({ dom, name, ...a })));
if (e5) for (const run of e5.results) for (const name of [...new Set(run.hr.map(a => a.name))]) seqs.push(run.hr.filter(a => a.name === name).map(a => ({ dom: run.domain, ...a })));
const traces = seqs.flat();
if (traces.length) {
  w('## E6 — Índice de Resolução (H_r) e TTL\n');
  const acc = traces.filter(t => t.expect === 'accept');
  w('H_r (fração de campos errados vs. oráculo) por tentativa, apenas registros aceitáveis:\n');
  w('| Tentativa | tentativas | H_r médio | aprovadas no validator | aprovadas c/ H_r>0 (validator aprovou erro) |\n|---|---|---|---|---|');
  for (const k of [1, 2, 3]) {
    const s = acc.filter(t => t.attempt === k);
    if (!s.length) continue;
    const pass = s.filter(t => t.valid);
    w(`| ${k} | ${s.length} | ${mean(s.map(t => t.hrOracle)).toFixed(3)} | ${pass.length} | ${pass.filter(t => t.hrOracle > 0).length} |`);
  }
  const syn = [];
  for (const seq of seqs) {
    let cur = null;
    for (const t of seq) {
      if (t.attempt === 1) { cur = { ...t, attempts: 1, converged: t.valid, nullOut: t.valid ? false : undefined }; syn.push(cur); }
      else if (cur) { cur.attempts = t.attempt; cur.converged = t.valid; }
    }
  }
  const okSyn = syn.filter(s => s.expect === 'accept');
  w(`\nSínteses sobre registros aceitáveis: ${okSyn.length}. Convergência (validator) em ≤k tentativas:`);
  for (const k of [1, 2, 3]) w(`- TTL=${k}: ${P(okSyn.filter(s => s.converged && s.attempts <= k).length / okSyn.length)}%`);
  w('\n| Variante | sínteses (reg. aceitáveis) | conv. na 1ª | na 2ª | na 3ª | não convergiu |\n|---|---|---|---|---|---|');
  for (const name of [...new Set(okSyn.map(s => s.name))].filter(n => n !== 'sem amortização')) {
    const g = okSyn.filter(s => s.name === name);
    const c = (k) => g.filter(s => s.converged && s.attempts === k).length;
    w(`| ${name} | ${g.length} | ${c(1)} | ${c(2)} | ${c(3)} | ${g.filter(s => !s.converged).length} |`);
  }
  const rej = syn.filter(s => s.expect === 'reject');
  w(`\nSínteses disparadas por registros que deveriam ser rejeitados: ${rej.length}; delas, o validator aprovou algum programa em ${rej.filter(s => s.converged).length} (programa que "inventa" uma saída válida).\n`);
}

// ---------------- E5 ----------------
if (e5) {
  w('## E5 — Repetições independentes\n');
  for (const dom of [...new Set(e5.results.map(r => r.domain))]) {
    const runs = e5.results.filter(r => r.domain === dom);
    const m = (k, f) => runs.map(r => f(r[k]));
    const corr = (x) => x.total.corrupt / x.n, ok = (x) => x.total.correct / x.n, fr = (x) => x.total.falseReject / x.n, calls = (x) => x.stats.llmCalls;
    const advCorr = (x) => { const t = x.perPhase.P6; return t ? t.corrupt / t.n : 0; };
    w(`### ${dom} (R=${runs.length})\n`);
    w('| Abordagem | Correto % (média±dp) | Corrupção % | Rej. falsa % | Corrupção adversarial % | Chamadas |\n|---|---|---|---|---|---|');
    for (const [k, lbl] of [['idae', 'IDAE (original)'], ['plus', 'IDAE+'], ['noval', 'IDAE sem validator'], ['direct', 'LLM-Direct (só P6)']]) {
      const f = (fn) => { const a = m(k, fn); return `${P(mean(a))}±${P(sd(a))}`; };
      w(`| ${lbl} | ${k === 'direct' ? '—' : f(ok)} | ${f(corr)} | ${f(fr)} | ${f(advCorr)} | ${mean(m(k, calls)).toFixed(1)}±${sd(m(k, calls)).toFixed(1)} |`);
    }
    const tests = [
      ['corrupção adversarial: LLM-Direct vs IDAE', m('direct', advCorr), m('idae', advCorr)],
      ['corrupção: IDAE sem validator vs IDAE', m('noval', corr), m('idae', corr)],
      ['corrupção: IDAE vs IDAE+', m('idae', corr), m('plus', corr)],
      ['correto: IDAE+ vs IDAE', m('plus', ok), m('idae', ok)],
      ['rej. falsa: IDAE vs IDAE+', m('idae', fr), m('plus', fr)],
      ['chamadas: IDAE+ vs IDAE', m('plus', calls), m('idae', calls)],
    ];
    w('\n| Comparação (pareada por execução) | Wilcoxon exato p | δ de Cliff |\n|---|---|---|');
    for (const [lbl, a, b] of tests) { const t = wilcoxonExact(a, b); w(`| ${lbl} | ${t.p.toPrecision(3)} (n≠0=${t.n}) | ${cliffsDelta(a, b).toFixed(2)} |`); }
    w();
  }
}

// ---------------- E7 ----------------
const e7 = load('e7-deriva.json');
if (e7) {
  w('## E7 — Deriva gradual e validator mal-especificado\n'); w(HEAD);
  for (const [rate, runs] of Object.entries(e7.partC)) { w(`| **deriva ${P(+rate)}% sem moeda** | | | | | | | |`); for (const r of runs) w(row(r)); }
  const partB = load('e7b-telos-mal-especificado.json')?.partB || e7.partB;
  w('\nParte B (telos mal-especificado; registro válido primeiro):\n'); w(HEAD); for (const r of partB) w(row(r));
  for (const r of partB) w(`- ${r.approach}: ` + Object.entries(r.perKind).map(([k, t]) => `${k}: ok ${t.correct}, corrupção ${t.corrupt}, rej ${t.correctReject}, rej.falsa ${t.falseReject}`).join('; '));
  w();
}

writeFileSync(join(RESULTS, 'RESUMO.md'), '# Resumo dos resultados — IDAE\n\n' + L.join('\n') + '\n');
console.log(L.join('\n'));
