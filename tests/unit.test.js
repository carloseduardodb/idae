// Testes unitários (sem LLM): garantem que oráculo, validators, estatística
// e a mecânica do IDAE estão corretos antes de gastar chamadas ao modelo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { domain as FIN } from '../src/domains/financial.js';
import { domain as IOT, statusOf } from '../src/domains/iot.js';
import { corrected as USGS, original as USGS_ORIG, loadPhases } from '../src/domains/usgs.js';
import { rng, compile, cleanCode, parseJsonReply, formatSignature } from '../src/util.js';
import { wilcoxonExact, mcnemarExact, wilson, cliffsDelta } from '../src/stats.js';
import { classify, compareOutput } from '../src/metrics.js';
import { IDAE, SchemaBased, LLMDirect, LLMValRetry } from '../src/approaches/index.js';

for (const D of [FIN, IOT]) {
  test(`${D.name}: toda verdade "accept" satisfaz o validator e o validator ancorado`, () => {
    for (const seed of [1, 2, 3]) {
      const r = rng(seed);
      for (const ph of D.phases) for (let i = 0; i < 200; i++) {
        const { raw, truth } = ph.gen(i, r);
        assert.equal(typeof raw, 'string');
        if (truth.expect === 'accept') {
          assert.ok(D.validator(truth.output), `${ph.id}#${i} ${raw} -> ${JSON.stringify(truth.output)}`);
          assert.ok(D.groundedValidator(truth.output, raw), `grounded ${ph.id}#${i}`);
        }
      }
    }
  });

  test(`${D.name}: geração é determinística por semente`, () => {
    const a = D.phases.map(p => p.gen(7, rng(42)).raw);
    const b = D.phases.map(p => p.gen(7, rng(42)).raw);
    assert.deepEqual(a, b);
  });

  test(`${D.name}: fase adversarial tem 7 rejeições e 3 aceites por ciclo`, () => {
    const r = rng(9), adv = D.phases.find(p => p.adversarial);
    const exp = Array.from({ length: 10 }, (_, i) => adv.gen(i, r).truth.expect);
    assert.equal(exp.filter(e => e === 'reject').length, 7);
  });

  test(`${D.name}: Schema-Based acerta 100% da Fase 1 e rejeita as demais`, () => {
    const sb = new SchemaBased(D), r = rng(5);
    for (let i = 0; i < 100; i++) {
      const { raw, truth } = D.phases[0].gen(i, r);
      assert.equal(classify(sb.process(raw), truth, D.tolerances).cls, 'correct', raw);
    }
    for (const ph of D.phases.slice(1, 5)) {
      const { raw } = ph.gen(0, r);
      assert.equal(sb.process(raw).accepted, false);
    }
  });
}

test('financeiro: offset -03:00 após 21h vira o dia seguinte em UTC', () => {
  const r = rng(1), p2 = FIN.phases[1];
  const { raw, truth } = p2.gen(0, r); // i % 5 === 0 => 21h–23h local
  const local = JSON.parse(raw).data_hora;
  const localDay = +local.slice(8, 10);
  assert.equal(+truth.output.date.slice(0, 2), localDay + 1);
});

test('iot: statusOf respeita os limiares', () => {
  assert.equal(statusOf('temperature', 40.5), 'critical');
  assert.equal(statusOf('temperature', 35), 'warning');
  assert.equal(statusOf('temperature', -1), 'warning');
  assert.equal(statusOf('humidity', 80), 'warning');
  assert.equal(statusOf('pressure', 1013), 'normal');
  assert.equal(statusOf('pressure', 955), 'critical');
});

test('usgs: 560 eventos; oráculo corrigido aceita todos e passa no validator', () => {
  const phases = loadPhases();
  assert.deepEqual(phases.map(p => p.raws.length), [100, 200, 100, 100, 60]);
  for (const p of phases) for (const raw of p.raws) {
    const t = USGS.truth(raw);
    assert.equal(t.expect, 'accept');
    assert.ok(USGS.validator(t.output), raw.slice(0, 120));
  }
});

test('usgs: nenhum evento tem magnitude nula; negativos de profundidade e CSV sem "sig" existem', () => {
  const phases = loadPhases();
  let nullMag = 0, negDepth = 0, csvNoSig = 0;
  for (const p of phases) for (const raw of p.raws) {
    const t = USGS.truth(raw).output;
    if (t.magnitude === null || Number.isNaN(t.magnitude)) nullMag++;
    if (t.depth_km < 0) negDepth++;
    if (t.significance === null) csvNoSig++;
  }
  assert.equal(nullMag, 0);
  assert.ok(negDepth >= 7);
  assert.equal(csvNoSig, 200 + 100 + 30);
});

test('usgs: telos original só é satisfatível fielmente em GeoJSON com depth >= 0', () => {
  const phases = loadPhases();
  let acc = 0;
  for (const p of phases) for (const raw of p.raws) {
    const t = USGS_ORIG.truth(raw);
    if (t.expect === 'accept') { acc++; assert.ok(USGS_ORIG.validator(t.output)); }
  }
  assert.equal(acc, 100 + 96 + 30);
});

test('util: sandbox aplica timeout em laço infinito e normaliza NaN', () => {
  const loop = compile('while(true){}');
  assert.throws(() => loop('x'));
  const nan = compile('return { v: NaN, u: undefined, s: entry }');
  assert.deepEqual(nan('a'), { v: null, s: 'a' });
});

test('util: cleanCode aceita cercas e declarações de função', () => {
  assert.equal(cleanCode('```js\nreturn 1;\n```'), 'return 1;');
  assert.equal(cleanCode('function f(entry) { return 2; }'), 'return 2;');
  assert.equal(parseJsonReply('```json\n{"a":1}\n```').a, 1);
  assert.equal(parseJsonReply('null'), null);
});

test('util: assinatura de formato', () => {
  assert.equal(formatSignature('{"b":1,"a":2}'), 'json:a,b');
  assert.equal(formatSignature('a|b|c'), 'pipe:3');
  assert.equal(formatSignature('a,b'), 'csv');
});

test('stats: Wilcoxon exato, McNemar exato, Wilson, Cliff', () => {
  // n=6, todas as diferenças positivas: p exato bicaudal = 2/64
  assert.ok(Math.abs(wilcoxonExact([1, 2, 3, 4, 5, 6], [0, 0, 0, 0, 0, 0]).p - 2 / 64) < 1e-12);
  // n=10 todos positivos: 2/1024
  assert.ok(Math.abs(wilcoxonExact(Array(10).fill(1).map((_, i) => i + 1), Array(10).fill(0)).p - 2 / 1024) < 1e-12);
  assert.equal(wilcoxonExact([1, 1], [1, 1]).p, 1);
  assert.ok(Math.abs(mcnemarExact(0, 6).p - 2 / 64) < 1e-12);
  const w = wilson(0, 100);
  assert.equal(w.lo, 0); assert.ok(w.hi > 0.03 && w.hi < 0.04);
  assert.equal(cliffsDelta([2, 3], [0, 1]), 1);
});

test('metrics: classificação contra o oráculo', () => {
  const truth = { expect: 'accept', output: { a: 'x', v: 10 } };
  assert.equal(classify({ accepted: true, output: { a: 'x', v: 10.005 } }, truth).cls, 'correct');
  assert.equal(classify({ accepted: true, output: { a: 'x', v: 11 } }, truth).cls, 'corrupt');
  assert.equal(classify({ accepted: false }, truth).cls, 'falseReject');
  assert.equal(classify({ accepted: true, output: {} }, { expect: 'reject' }).cls, 'corrupt');
  assert.equal(classify({ accepted: false }, { expect: 'reject' }).cls, 'correctReject');
  assert.deepEqual(compareOutput({ s: 3 }, { s: null }), ['s']);
});

// ---------- Mecânica do IDAE com LLM simulado ----------
const GOOD_FIN_P1 = `const o = JSON.parse(entry);
const R = {BRL:0.2,USD:1,EUR:1.1,GBP:1.27};
if (!R[o.currency] || !(o.amount > 0)) return null;
const d = new Date(o.timestamp), p = n => String(n).padStart(2,'0');
return { audit_id: o.transaction_id, value_in_usd: Math.round(o.amount*R[o.currency]*100)/100,
  date: p(d.getUTCDate())+'/'+p(d.getUTCMonth()+1)+'/'+d.getUTCFullYear(),
  category: o.currency==='BRL'?'domestic':'international', status:'valid' };`;

test('IDAE: amortiza — 1 chamada para 50 registros do mesmo formato', async () => {
  let calls = 0;
  const idae = new IDAE(FIN, { llm: async () => { calls++; return GOOD_FIN_P1; } });
  const r = rng(3);
  for (let i = 0; i < 50; i++) {
    const { raw, truth } = FIN.phases[0].gen(i, r);
    assert.equal(classify(await idae.process(raw), truth, FIN.tolerances).cls, 'correct');
  }
  assert.equal(calls, 1);
});

test('IDAE original: registro inválido descarta o programa e esgota o formato (TTL)', async () => {
  let calls = 0;
  const idae = new IDAE(FIN, { llm: async () => { calls++; return GOOD_FIN_P1; } });
  const ok = JSON.stringify({ transaction_id: 'A1', amount: 10, currency: 'USD', timestamp: '2024-01-01T00:00:00Z' });
  const bad = JSON.stringify({ transaction_id: 'A2', amount: -10, currency: 'USD', timestamp: '2024-01-01T00:00:00Z' });
  assert.equal((await idae.process(ok)).accepted, true);
  assert.equal((await idae.process(bad)).accepted, false);
  assert.equal(calls, 1 + 3);
  // Mesmo formato, registro válido: rejeitado sem síntese (formato "esgotado").
  const r = await idae.process(ok);
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'format-exhausted');
  assert.equal(calls, 4);
});

test('IDAE com rejeição explícita: registro inválido não descarta o programa', async () => {
  let calls = 0;
  const idae = new IDAE(FIN, { explicitReject: true, llm: async () => { calls++; return GOOD_FIN_P1; } });
  const ok = JSON.stringify({ transaction_id: 'A1', amount: 10, currency: 'USD', timestamp: '2024-01-01T00:00:00Z' });
  const bad = JSON.stringify({ transaction_id: 'A2', amount: -10, currency: 'USD', timestamp: '2024-01-01T00:00:00Z' });
  await idae.process(ok);
  assert.equal((await idae.process(bad)).reason, 'explicit-reject');
  assert.equal((await idae.process(ok)).accepted, true);
  assert.equal(calls, 1);
});

test('IDAE N-version: discordância entre programas bloqueia o registro', async () => {
  let n = 0;
  const wrong = GOOD_FIN_P1.replace('getUTCDate()', 'getUTCDate()+0*1').replace("'valid'", "'valid'") .replace('o.amount*R', '1.01*o.amount*R');
  const idae = new IDAE(FIN, { nversion: 2, llm: async () => (n++ % 2 === 0 ? GOOD_FIN_P1 : wrong) });
  const ok = JSON.stringify({ transaction_id: 'A1', amount: 1000, currency: 'USD', timestamp: '2024-01-01T00:00:00Z' });
  const r = await idae.process(ok);
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'nversion-disagree-at-synthesis');
});

test('IDAE sem validator aceita saída fabricada; com validator ancorado, rejeita id inventado', async () => {
  const fab = `return { audit_id: 'INVENTED', value_in_usd: 1, date: '01/01/2024', category: 'international', status: 'valid' };`;
  const raw = JSON.stringify({ sensor: 't', celsius: 20 });
  const a = new IDAE(FIN, { validator: 'none', llm: async () => fab });
  assert.equal((await a.process(raw)).accepted, true);
  const b = new IDAE(FIN, { validator: 'format', llm: async () => fab });
  assert.equal((await b.process(raw)).accepted, true); // formato não detecta fabricação
  const c = new IDAE(FIN, { validator: 'grounded', llm: async () => fab });
  assert.equal((await c.process(raw)).accepted, false);
});

test('LLM-Direct e LLM+Val+Retry: null do modelo = rejeição', async () => {
  const d = new LLMDirect(FIN, { llm: async () => 'null' });
  assert.equal((await d.process('x')).accepted, false);
  let calls = 0;
  const v = new LLMValRetry(FIN, { llm: async () => { calls++; return '{"audit_id":""}'; } });
  assert.equal((await v.process('x')).accepted, false);
  assert.equal(calls, 3);
});

test('IDAE com rejeição explícita amortiza a rejeição (sem reamostrar o LLM)', async () => {
  let calls = 0;
  const idae = new IDAE(FIN, { explicitReject: true, llm: async () => { calls++; return GOOD_FIN_P1; } });
  const noCur = (i) => JSON.stringify({ transaction_id: `N${i}`, amount: 10, timestamp: '2024-01-01T00:00:00Z' });
  for (let i = 0; i < 5; i++) assert.equal((await idae.process(noCur(i))).accepted, false);
  assert.equal(calls, 1);
});
