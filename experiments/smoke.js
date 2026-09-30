// Smoke test: poucas chamadas reais ao Opus 4.5 para validar prompts e latência.
import { domain as FIN } from '../src/domains/financial.js';
import { domain as IOT } from '../src/domains/iot.js';
import { IDAE, LLMDirect } from '../src/approaches/index.js';
import { buildStream, subsample, runStream, printTable } from '../src/harness.js';
import { MODEL } from '../src/llm-client.js';

console.log('modelo:', MODEL);
for (const D of [FIN, IOT]) {
  const s = subsample(buildStream(D, { seed: 7, n: 10, nAdv: 10 }), 3, 10);
  const a = await runStream(new IDAE(D), D, s);
  const b = await runStream(new LLMDirect(D), D, s.filter(e => e.phase === 'P6'), { concurrency: 5 });
  printTable(D.name, [a, b]);
  for (const r of a.records.filter(x => x.cls !== 'correct' && x.cls !== 'correctReject')) console.log('  IDAE', r.phase, r.kind, r.cls, r.wrong, r.reason, JSON.stringify(r.output));
  for (const r of b.records.filter(x => x.cls !== 'correct' && x.cls !== 'correctReject')) console.log('  LLMD', r.phase, r.kind, r.cls, r.wrong, JSON.stringify(r.output));
  console.log('  ms/chamada IDAE:', Math.round(a.stats.llmMs / a.stats.llmCalls), ' LLM-Direct:', Math.round(b.stats.llmMs / b.stats.llmCalls));
}
