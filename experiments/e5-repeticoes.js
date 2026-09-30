// =============================================================================
// E5 — Repetições independentes (reavaliação do Exp-C4).
//
// R execuções com sementes diferentes (dados diferentes + não-determinismo do
// LLM), nos dois domínios. Compara, por execução:
//   IDAE (original), IDAE+ e IDAE sem validator no fluxo completo;
//   LLM-Direct na fase adversarial (onde a corrupção se concentra).
// Testes: Wilcoxon signed-rank exato pareado por execução.
// =============================================================================

import { domain as FIN } from '../src/domains/financial.js';
import { domain as IOT } from '../src/domains/iot.js';
import { IDAE, LLMDirect } from '../src/approaches/index.js';
import { buildStream, runStream, save } from '../src/harness.js';
import { pool } from '../src/util.js';
import { compareOutput } from '../src/metrics.js';

const R = parseInt(process.env.R || '6');
const N = parseInt(process.env.N || '50');
const NADV = parseInt(process.env.NADV || '30');
const PAR = parseInt(process.env.PAR || '4');

const jobs = [];
for (const D of [FIN, IOT]) for (let k = 0; k < R; k++) jobs.push({ D, run: k + 1, seed: 2001 + k });

const results = await pool(jobs, PAR, async ({ D, run, seed }) => {
  const stream = buildStream(D, { seed, n: N, nAdv: NADV });
  const byRaw = new Map(stream.map(e => [e.raw, e]));
  const hr = [];
  const hook = (name) => ({ raw, attempt, variant, out, valid }) => {
    const e = byRaw.get(raw), t = e?.truth;
    const fields = t?.expect === 'accept' ? Object.keys(t.output) : null;
    const wrong = fields ? (out && typeof out === 'object' ? compareOutput(out, t.output, D.tolerances).length : fields.length) : null;
    hr.push({ name, phase: e?.phase, attempt, variant, valid, expect: t?.expect, hrOracle: fields ? wrong / fields.length : null });
  };
  const adv = stream.filter(e => e.phase === 'P6');
  const [idae, plus, noval, direct] = await Promise.all([
    runStream(new IDAE(D, { name: 'IDAE (original)', onAttempt: hook('IDAE (original)') }), D, stream),
    runStream(new IDAE(D, { name: 'IDAE+', validator: 'grounded', explicitReject: true, nversion: 2, onAttempt: hook('IDAE+') }), D, stream),
    runStream(new IDAE(D, { name: 'IDAE sem validator', validator: 'none', onAttempt: hook('IDAE sem validator') }), D, stream),
    runStream(new LLMDirect(D), D, adv, { concurrency: 5 }),
  ]);
  const strip = (x) => ({ ...x, records: x.records.filter(r => r.cls === 'corrupt' || r.cls === 'falseReject') });
  const line = [idae, plus, noval, direct].map(x => `${x.approach}: ok ${x.total.correct}/${x.n} corr ${x.total.corrupt} fr ${x.total.falseReject} calls ${x.stats.llmCalls}`).join(' | ');
  console.log(`[${D.name} run ${run}] ${line}`);
  return { domain: D.name, run, seed, idae: strip(idae), plus: strip(plus), noval: strip(noval), direct: strip(direct), hr };
});

console.log('arquivo:', save('e5-repeticoes.json', { R, N, NADV, results }));
