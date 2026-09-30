// =============================================================================
// E4 — Ablação (reavaliação do Exp-C6) + variantes propostas
//
// Mesmo fluxo do E2 (mesma semente). Cada variante remove ou adiciona um
// único mecanismo:
//   IDAE (original)          validator de formato, amortização, TTL=3
//   sem validator            aceita qualquer objeto produzido pelo programa
//   sem amortização          sintetiza um programa por registro (subamostra)
//   validator ancorado       formato + identificador presente na entrada (+ status coerente no IoT)
//   rejeição explícita       null do programa rejeita o registro sem descartar o programa
//   N-version (k=2)          dois programas independentes precisam concordar
//   IDAE+                    ancorado + rejeição explícita + N-version
// Obs.: a Fase 2 não se aplica aqui — o telos é imutável e a cadeia tem uma
// única intenção; seu efeito é medido no E1.
// =============================================================================

import { domain as FIN } from '../src/domains/financial.js';
import { domain as IOT } from '../src/domains/iot.js';
import { IDAE } from '../src/approaches/index.js';
import { buildStream, subsample, runStream, save, printTable } from '../src/harness.js';
import { compareOutput } from '../src/metrics.js';

const N = parseInt(process.env.N || '100');
const NADV = parseInt(process.env.NADV || '50');
const SUB = parseInt(process.env.SUB || '20');
const SEED = parseInt(process.env.SEED || '1001');

const VARIANTS = [
  ['IDAE (original)', {}],
  ['sem validator', { validator: 'none' }],
  ['validator ancorado', { validator: 'grounded' }],
  ['rejeição explícita', { explicitReject: true }],
  ['N-version (k=2)', { nversion: 2 }],
  ['IDAE+ (ancorado+rejeição+NV2)', { validator: 'grounded', explicitReject: true, nversion: 2 }],
];

const out = {};
await Promise.all([FIN, IOT].map(async (D) => {
  const stream = buildStream(D, { seed: SEED, n: N, nAdv: NADV });
  const byRaw = new Map(stream.map(e => [e.raw, e.truth]));
  const sub = subsample(stream, SUB, NADV);
  const hr = {};
  const mk = (name, opts) => new IDAE(D, {
    name, ...opts,
    onAttempt: ({ raw, attempt, variant, out: o, valid }) => {
      const t = byRaw.get(raw);
      const fields = t?.expect === 'accept' ? Object.keys(t.output) : null;
      const wrong = fields ? (o && typeof o === 'object' ? compareOutput(o, t.output, D.tolerances).length : fields.length) : null;
      (hr[name] ??= []).push({ phase: stream.find(e => e.raw === raw)?.phase, attempt, variant, valid, hrOracle: fields ? wrong / fields.length : null, expect: t?.expect });
    },
  });
  const runs = await Promise.all([
    ...VARIANTS.map(([name, opts]) => runStream(mk(name, opts), D, stream)),
    runStream(mk('sem amortização', { amortize: false }), D, sub, { concurrency: 5 }),
  ]);
  out[D.name] = { runs, hr };
  printTable(`E4 — ${D.name}`, runs);
}));
console.log('arquivo:', save('e4-ablacao.json', { N, NADV, SUB, SEED, results: out }));
