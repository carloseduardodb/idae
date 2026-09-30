// =============================================================================
// E2 — Comparação com baselines em dois domínios (reavaliação dos Exps. 2–3)
//
// Todas as abordagens recebem a MESMA especificação e são medidas pelo MESMO
// oráculo. A "alucinação" do artigo original é aqui medida como corrupção
// silenciosa: registro aceito que difere da verdade ou que deveria ser
// rejeitado — para TODAS as abordagens, inclusive o IDAE.
//
// Abordagens por registro (LLM-Direct, LLM+Val+Retry) rodam numa subamostra
// (SUB por fase normal + toda a fase adversarial); o IDAE e o Schema-Based
// rodam no fluxo completo e também são reportados na mesma subamostra.
// =============================================================================

import { domain as FIN } from '../src/domains/financial.js';
import { domain as IOT } from '../src/domains/iot.js';
import { IDAE, LLMDirect, LLMValRetry, SchemaBased } from '../src/approaches/index.js';
import { buildStream, subsample, runStream, save, printTable } from '../src/harness.js';
import { MODEL } from '../src/llm-client.js';

const N = parseInt(process.env.N || '100');
const NADV = parseInt(process.env.NADV || '50');
const SUB = parseInt(process.env.SUB || '20');
const SEED = parseInt(process.env.SEED || '1001');
const CONC = parseInt(process.env.CONC || '5');
const TAG = process.env.TAG || MODEL;

const out = {};
await Promise.all([FIN, IOT].map(async (D) => {
  const stream = buildStream(D, { seed: SEED, n: N, nAdv: NADV });
  const sub = subsample(stream, SUB, NADV);
  const [schema, idae, direct, retry] = await Promise.all([
    runStream(new SchemaBased(D), D, stream),
    runStream(new IDAE(D), D, stream),
    runStream(new LLMDirect(D), D, sub, { concurrency: CONC }),
    runStream(new LLMValRetry(D), D, sub, { concurrency: CONC }),
  ]);
  out[D.name] = { schema, idae, direct, retry };
  printTable(`E2 — ${D.name} (${TAG})`, [schema, idae, direct, retry]);
}));
console.log('arquivo:', save(`e2-baselines-${TAG}.json`, { N, NADV, SUB, SEED, results: out }));
