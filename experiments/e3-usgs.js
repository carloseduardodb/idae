// =============================================================================
// E3 — Dados reais do USGS (reavaliação do Exp-C5), 560 eventos.
//
// (a) Telos CORRIGIDO (significance = null quando ausente; depth >= -10):
//     IDAE, IDAE+ e LLM-Direct, todos comparados campo a campo com o oráculo.
// (b) Telos ORIGINAL do artigo (exige significance inteiro, depth >= 0):
//     mede quantos registros CSV são aceitos com "significance" fabricada e
//     quantos eventos com profundidade negativa (válidos) são rejeitados.
// =============================================================================

import { corrected, original, loadPhases } from '../src/domains/usgs.js';
import { IDAE, LLMDirect } from '../src/approaches/index.js';
import { runStream, save, printTable } from '../src/harness.js';

const CONC = parseInt(process.env.CONC || '5');

function stream(D) {
  const s = [];
  for (const ph of loadPhases()) ph.raws.forEach((raw, idx) => {
    s.push({ phase: ph.id, idx, raw, truth: D.truth(raw), kind: raw.trim().startsWith('{') ? 'geojson' : 'csv' });
  });
  return s;
}

const sc = stream(corrected), so = stream(original);
const runs = await Promise.all([
  runStream(new IDAE(corrected, { name: 'IDAE [telos corrigido]' }), corrected, sc),
  runStream(new IDAE(corrected, { name: 'IDAE+ [telos corrigido]', validator: 'grounded', explicitReject: true, nversion: 2 }), corrected, sc),
  runStream(new LLMDirect(corrected, { name: 'LLM-Direct [telos corrigido]' }), corrected, sc, { concurrency: CONC }),
  runStream(new IDAE(original, { name: 'IDAE [telos original]' }), original, so),
  runStream(new LLMDirect(original, { name: 'LLM-Direct [telos original]' }), original, so, { concurrency: CONC }),
]);
printTable('E3 — USGS', runs);

// Análise específica do telos original: significance fabricada em CSV.
const fabric = {};
for (const r of runs.filter(x => x.approach.includes('original'))) {
  const recs = r.records.map((rec, i) => ({ ...rec, src: so[i] }));
  const csvAccepted = recs.filter(x => x.src.kind === 'csv' && x.cls === 'corrupt');
  const values = {};
  for (const x of csvAccepted) { const v = x.output?.significance; values[v] = (values[v] || 0) + 1; }
  const negDepth = recs.filter(x => corrected.truth(x.src.raw).output.depth_km < 0);
  fabric[r.approach] = {
    csvAcceptedWithFabricatedSignificance: csvAccepted.length,
    fabricatedValues: values,
    negativeDepthEvents: negDepth.length,
    negativeDepthRejected: negDepth.filter(x => x.cls === 'correctReject').length,
  };
}
console.log(JSON.stringify(fabric, null, 1));
for (const r of runs) console.log(r.approach, 'erros por campo', JSON.stringify(r.total.fieldErrors), 'por fase', Object.entries(r.perPhase).map(([k, t]) => `${k}:${t.correct}/${t.n}`).join(' '));
console.log('arquivo:', save('e3-usgs.json', { results: runs, fabrication: fabric }));
