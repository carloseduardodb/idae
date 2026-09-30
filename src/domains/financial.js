// =============================================================================
// financial.js — Domínio financeiro com oráculo.
//
// Mantém a estrutura das fases do experimento original (JSON limpo, campos
// renomeados, pré-agregado, pipe informal, CSV, adversarial), mas cada
// registro é gerado junto com sua verdade-terreno, eliminando ambiguidades
// do gerador original (ex.: campo "amount_brl" com moeda USD).
// =============================================================================

const RATES = { BRL: 0.2, USD: 1, EUR: 1.1, GBP: 1.27 };
const INFORMAL = { real: 'BRL', dolar: 'USD', euro: 'EUR', libra: 'GBP' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PREFIX = ['TX', 'OP', 'TR', 'PG', 'RF', 'DB', 'CR', 'TF', 'NF', 'RX'];
const CURS = ['BRL', 'USD', 'EUR', 'GBP'];

export const SPEC = `Target record (the FINAL, immutable goal — "telos"):
{
  "audit_id":     non-empty string — the transaction identifier copied verbatim from the input,
  "value_in_usd": positive number — the transaction amount converted to USD using EXACTLY these rates:
                  BRL * 0.2, USD * 1, EUR * 1.1, GBP * 1.27
                  (informal names: real=BRL, dolar=USD, euro=EUR, libra=GBP; codes may be lowercase).
                  If the input already gives the value in USD (e.g. a field named value_usd), do not convert it again.
                  Brazilian number format "1.234,56" means 1234.56,
  "date":         string "DD/MM/YYYY" — the UTC calendar date of the transaction
                  (convert timestamps with offsets to UTC first; timestamps without offset are already UTC),
  "category":     "domestic" if the currency is BRL, otherwise "international",
  "status":       "valid"
}
Rejection rule: if a record cannot be converted faithfully — missing currency, missing date,
amount that is zero, negative or not a number, currency outside {BRL, USD, EUR, GBP}, or a record
that is not a financial transaction at all — it must be REJECTED, never guessed.`;

// Validator do telos (nível "formato", equivalente ao validator original).
export function validator(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  if (typeof o.audit_id !== 'string' || !o.audit_id.trim()) return false;
  if (typeof o.value_in_usd !== 'number' || !Number.isFinite(o.value_in_usd) || o.value_in_usd <= 0) return false;
  if (typeof o.date !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(o.date)) return false;
  const [d, m, y] = o.date.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) return false;
  if (o.category !== 'domestic' && o.category !== 'international') return false;
  if (o.status !== 'valid' && o.status !== 'invalid') return false;
  return true;
}

// Validator com "ancoragem" (grounding): além do formato, exige que o
// identificador exista literalmente na entrada — verificável sem oráculo.
export function groundedValidator(o, raw) {
  if (!validator(o)) return false;
  return typeof raw === 'string' && raw.includes(o.audit_id);
}

export const tolerances = { value_in_usd: 0.011 };

// ---------------------------------------------------------------------------
const pad = (n, w = 2) => String(n).padStart(w, '0');
const ddmmyyyy = (dt) => `${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
const round2 = (x) => Math.round(x * 100) / 100;
const brFormat = (x) => {
  const [i, f] = x.toFixed(2).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + f;
};
function accept(audit_id, amount, cur, utcDate) {
  return {
    expect: 'accept',
    output: {
      audit_id, value_in_usd: round2(amount * RATES[cur]), date: ddmmyyyy(utcDate),
      category: cur === 'BRL' ? 'domestic' : 'international', status: 'valid',
    },
  };
}
const REJECT = { expect: 'reject' };
const id = (i, base) => `${PREFIX[i % PREFIX.length]}${pad(i + base, 4)}`;

function randomUtc(r) {
  return new Date(Date.UTC(2024, r.int(0, 11), r.int(1, 28), r.int(0, 23), r.int(0, 59), 0));
}

// P1 — JSON limpo, timestamps UTC.
function p1(i, r) {
  const cur = CURS[i % 4], amount = r.range(10, 5000), dt = randomUtc(r), tid = id(i, 0);
  const raw = JSON.stringify({ transaction_id: tid, amount, currency: cur, timestamp: dt.toISOString().replace('.000', '') });
  return { raw, truth: accept(tid, amount, cur, dt) };
}

// P2 — JSON renomeado (fornecedor brasileiro), timestamps com offset -03:00.
// Registros após 21h locais caem no dia seguinte em UTC.
function p2(i, r) {
  const cur = CURS[i % 4], amount = r.range(10, 5000), tid = id(i, 1000);
  const y = 2024, mo = r.int(1, 12), d = r.int(1, 28), h = i % 5 === 0 ? r.int(21, 23) : r.int(8, 20), mi = r.int(0, 59);
  const local = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00-03:00`;
  const raw = JSON.stringify({ id_transacao: tid, valor: amount, moeda: cur, data_hora: local });
  return { raw, truth: accept(tid, amount, cur, new Date(local)) };
}

// P3 — Pré-agregado: valor já em USD (não deve ser convertido de novo).
function p3(i, r) {
  const cur = CURS[i % 4], usd = r.range(10, 5000), tid = id(i, 2000);
  const dt = new Date(Date.UTC(2024, r.int(0, 11), r.int(1, 28)));
  const raw = JSON.stringify({
    ref: tid, value_usd: usd, orig_currency: cur,
    date: dt.toISOString().slice(0, 10), category: cur === 'BRL' ? 'domestic' : 'international',
  });
  const truth = accept(tid, usd, 'USD', dt);
  truth.output.category = cur === 'BRL' ? 'domestic' : 'international';
  return { raw, truth };
}

// P4 — Pipe informal: moeda por extenso, número brasileiro, mês em português.
function p4(i, r) {
  const names = Object.keys(INFORMAL), name = names[i % 4], cur = INFORMAL[name];
  const amount = r.range(10, 9000), tid = id(i, 3000);
  const mo = r.int(0, 11), d = r.int(1, 28);
  const raw = `${tid}|${name}|${brFormat(amount)}|${pad(d)}-${MESES[mo]}-2024`;
  return { raw, truth: accept(tid, amount, cur, new Date(Date.UTC(2024, mo, d))) };
}

// P5 — CSV sem cabeçalho, colunas em ordem diferente (timestamp,moeda,valor,id).
function p5(i, r) {
  const cur = CURS[(i + 1) % 4], amount = r.range(10, 5000), dt = randomUtc(r), tid = id(i, 4000);
  const raw = `${dt.toISOString().replace('.000', '')},${cur},${amount},${tid}`;
  return { raw, truth: accept(tid, amount, cur, dt) };
}

// P6 — Adversarial: 7 variantes que DEVEM ser rejeitadas, 3 aceitáveis porém ardilosas.
const ADV = [
  (i, r) => ({ kind: 'sem-moeda', raw: JSON.stringify({ transaction_id: `AMB${pad(i, 4)}`, amount: r.range(10, 5000), timestamp: '2024-06-15T10:00:00Z' }), truth: REJECT }),
  (i) => ({ kind: 'valor-zero', raw: JSON.stringify({ transaction_id: `ZERO${pad(i, 4)}`, amount: 0, currency: 'USD', timestamp: '2024-06-15T10:00:00Z' }), truth: REJECT }),
  (i, r) => ({ kind: 'valor-negativo', raw: JSON.stringify({ transaction_id: `NEG${pad(i, 4)}`, amount: -r.range(10, 5000), currency: 'EUR', timestamp: '2024-06-15T10:00:00Z' }), truth: REJECT }),
  (i, r) => ({ kind: 'sem-data', raw: JSON.stringify({ transaction_id: `NODT${pad(i, 4)}`, amount: r.range(10, 5000), currency: 'BRL' }), truth: REJECT }),
  (i, r) => ({ kind: 'outro-dominio', raw: JSON.stringify({ sensor: `temp-${i}`, celsius: r.range(15, 40), humidity: r.range(0, 1) }), truth: REJECT }),
  (i) => ({ kind: 'valor-nao-numerico', raw: JSON.stringify({ transaction_id: `NAN${pad(i, 4)}`, amount: 'N/A', currency: 'GBP', timestamp: '2024-06-15T10:00:00Z' }), truth: REJECT }),
  (i, r) => ({ kind: 'moeda-desconhecida', raw: JSON.stringify({ transaction_id: `XYZ${pad(i, 4)}`, amount: r.range(10, 5000), currency: 'JPY', timestamp: '2024-06-15T10:00:00Z' }), truth: REJECT }),
  (i, r) => {
    const a = r.range(10, 5000);
    return { kind: 'aceita:moeda-minuscula-valor-string', raw: JSON.stringify({ transaction_id: `LOW${pad(i, 4)}`, amount: a.toFixed(2), currency: 'usd', timestamp: '2024-06-15T10:00:00Z' }), truth: accept(`LOW${pad(i, 4)}`, a, 'USD', new Date('2024-06-15T10:00:00Z')) };
  },
  (i, r) => {
    const a = r.range(1000, 9000);
    return { kind: 'aceita:numero-brasileiro', raw: JSON.stringify({ transaction_id: `BRN${pad(i, 4)}`, amount: brFormat(a), currency: 'BRL', timestamp: '2024-06-15T10:00:00Z' }), truth: accept(`BRN${pad(i, 4)}`, a, 'BRL', new Date('2024-06-15T10:00:00Z')) };
  },
  (i, r) => {
    const a = r.range(10, 5000);
    return { kind: 'aceita:virada-de-dia-utc', raw: JSON.stringify({ transaction_id: `UTC${pad(i, 4)}`, amount: a, currency: 'EUR', timestamp: '2024-12-31T22:30:00-03:00' }), truth: accept(`UTC${pad(i, 4)}`, a, 'EUR', new Date('2024-12-31T22:30:00-03:00')) };
  },
];
function p6(i, r) { return ADV[i % ADV.length](i, r); }

export const phases = [
  { id: 'P1', label: 'JSON limpo (UTC)', gen: p1 },
  { id: 'P2', label: 'JSON renomeado, offset -03:00', gen: p2 },
  { id: 'P3', label: 'Pré-agregado (valor já em USD)', gen: p3 },
  { id: 'P4', label: 'Pipe informal (moeda por extenso, número BR)', gen: p4 },
  { id: 'P5', label: 'CSV sem cabeçalho, colunas reordenadas', gen: p5 },
  { id: 'P6', label: 'Adversarial (7 rejeitar / 3 aceitar)', gen: p6, adversarial: true },
];

export const domain = { name: 'financeiro', SPEC, validator, groundedValidator, tolerances, phases };
