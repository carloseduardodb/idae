# Resumo dos resultados — IDAE

## E1 — Cadeia de 4 intenções (compressão + Fase 2)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| IDAE-cadeia (4 intenções) | 1000 | 69.8 | 29.7 [26.9–32.6] | 0/0 | 5 | 56 | 24991 |

| Fase | Correto | Corrupção | Campos errados | Caminhos |
|---|---|---|---|---|
| P1 | 200/200 | 0 | {} | {"[1,2,3,4]":200} |
| P2 | 200/200 | 0 | {} | {"[1,3,4]":200} |
| P3 | 50/200 | 150 | {"value_in_usd":150,"category":50} | {"[1,2,3,4]":200} |
| P4 | 200/200 | 0 | {} | {"[1,4]":200} |
| P5 | 48/200 | 147 | {"value_in_usd":147,"category":49,"date":1} | {"rejeitado:systemic:1/F2":5,"[1,2,3,4]":195} |

Chamadas LLM: 56; programas gerados: {"1":40,"2":1,"3":2,"4":1}; reconstruções de validator: {"1":2}; compressões: {"2":2,"3":1}; reativações: 3; erros sistêmicos: 5.

## E2 — Baselines (claude-opus-4.5)

### financeiro — fluxo completo (Schema-Based, IDAE)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 550 | 19.1 | 0.0 [0.0–0.7] | 35/35 | 410 | 0 | 0 |
| IDAE | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 17 | 14780 |

### financeiro — subamostra pareada (20/fase + 50 adversariais)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 150 | 16.7 | 0.0 [0.0–2.5] | 35/35 | 90 | — | — |
| IDAE | 150 | 66.7 | 0.0 [0.0–2.5] | 35/35 | 15 | — | — |
| LLM-Direct | 150 | 72.7 | 4.0 [1.8–8.5] | 35/35 | 0 | 150 | 58071 |
| LLM+Val+Retry | 150 | 74.0 | 2.7 [1.0–6.7] | 35/35 | 0 | 150 | 58063 |

Por fase (correto/n, corrupção):

| Abordagem | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| Schema-Based | 100/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 5/50 (0) |
| IDAE | 100/100 (0) | 100/100 (0) | 100/100 (0) | 100/100 (0) | 100/100 (0) | 0/50 (0) |
| LLM-Direct | 20/20 (0) | 20/20 (0) | 20/20 (0) | 15/20 (5) | 19/20 (1) | 15/50 (0) |
| LLM+Val+Retry | 20/20 (0) | 20/20 (0) | 20/20 (0) | 16/20 (4) | 20/20 (0) | 15/50 (0) |

Fase adversarial por variante (IDAE | LLM-Direct | LLM+Val+Retry):

- sem-moeda: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-zero: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-negativo: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- sem-data: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- outro-dominio: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-nao-numerico: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- moeda-desconhecida: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- aceita:moeda-minuscula-valor-string: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0
- aceita:numero-brasileiro: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0
- aceita:virada-de-dia-utc: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0

McNemar exato (decisão correta, IDAE vs LLM-Direct, subamostra): só IDAE acerta=6, só LLM-Direct acerta=15, p=0.0784

Erros por campo — IDAE: {}; LLM-Direct: {"audit_id":5,"value_in_usd":1}; LLM+Val+Retry: {"audit_id":4}

### iot — fluxo completo (Schema-Based, IDAE)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 550 | 19.1 | 0.0 [0.0–0.7] | 35/35 | 410 | 0 | 0 |
| IDAE | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 20 | 23647 |

### iot — subamostra pareada (20/fase + 50 adversariais)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 150 | 16.7 | 0.0 [0.0–2.5] | 35/35 | 90 | — | — |
| IDAE | 150 | 66.7 | 0.0 [0.0–2.5] | 35/35 | 15 | — | — |
| LLM-Direct | 150 | 76.0 | 0.7 [0.1–3.7] | 35/35 | 0 | 150 | 74500 |
| LLM+Val+Retry | 150 | 76.0 | 0.7 [0.1–3.7] | 35/35 | 0 | 150 | 74501 |

Por fase (correto/n, corrupção):

| Abordagem | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| Schema-Based | 100/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 5/50 (0) |
| IDAE | 100/100 (0) | 100/100 (0) | 100/100 (0) | 100/100 (0) | 100/100 (0) | 0/50 (0) |
| LLM-Direct | 20/20 (0) | 20/20 (0) | 19/20 (1) | 20/20 (0) | 20/20 (0) | 15/50 (0) |
| LLM+Val+Retry | 20/20 (0) | 20/20 (0) | 19/20 (1) | 20/20 (0) | 20/20 (0) | 15/50 (0) |

Fase adversarial por variante (IDAE | LLM-Direct | LLM+Val+Retry):

- sem-metrica: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-NaN: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- outro-dominio: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- sem-timestamp: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- fora-de-faixa-9999C: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- umidade-140: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- sem-zona: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- aceita:pressao-kPa: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0
- aceita:virgula-decimal: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0
- aceita:limite-critico: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0

McNemar exato (decisão correta, IDAE vs LLM-Direct, subamostra): só IDAE acerta=1, só LLM-Direct acerta=15, p=0.000519

Erros por campo — IDAE: {}; LLM-Direct: {"value":1}; LLM+Val+Retry: {"value":1}

## E2 — Baselines (claude-haiku-4.5)

### financeiro — fluxo completo (Schema-Based, IDAE)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 550 | 19.1 | 0.0 [0.0–0.7] | 35/35 | 410 | 0 | 0 |
| IDAE | 550 | 51.3 | 21.5 [18.2–25.1] | 35/35 | 115 | 19 | 16969 |

### financeiro — subamostra pareada (20/fase + 50 adversariais)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 150 | 16.7 | 0.0 [0.0–2.5] | 35/35 | 90 | — | — |
| IDAE | 150 | 38.7 | 14.7 [9.9–21.2] | 35/35 | 35 | — | — |
| LLM-Direct | 150 | 59.3 | 20.7 [15.0–27.8] | 30/35 | 0 | 150 | 59291 |
| LLM+Val+Retry | 150 | 59.3 | 17.3 [12.1–24.2] | 35/35 | 0 | 160 | 63506 |

Por fase (correto/n, corrupção):

| Abordagem | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| Schema-Based | 100/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 5/50 (0) |
| IDAE | 100/100 (0) | 80/100 (20) | 0/100 (0) | 100/100 (0) | 2/100 (98) | 0/50 (0) |
| LLM-Direct | 15/20 (5) | 12/20 (8) | 20/20 (0) | 11/20 (9) | 16/20 (4) | 15/50 (5) |
| LLM+Val+Retry | 15/20 (5) | 12/20 (8) | 20/20 (0) | 11/20 (9) | 16/20 (4) | 15/50 (0) |

Fase adversarial por variante (IDAE | LLM-Direct | LLM+Val+Retry):

- sem-moeda: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-zero: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-negativo: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- sem-data: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 5 rej 0 fr 0 | ok 0 corr 0 rej 5 fr 0
- outro-dominio: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-nao-numerico: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- moeda-desconhecida: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- aceita:moeda-minuscula-valor-string: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0
- aceita:numero-brasileiro: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0
- aceita:virada-de-dia-utc: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0

McNemar exato (decisão correta, IDAE vs LLM-Direct, subamostra): só IDAE acerta=25, só LLM-Direct acerta=51, p=0.00384

Erros por campo — IDAE: {"date":20,"value_in_usd":98}; LLM-Direct: {"value_in_usd":24,"date":2,"<should-reject>":5}; LLM+Val+Retry: {"value_in_usd":24,"date":2}

### iot — fluxo completo (Schema-Based, IDAE)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 550 | 19.1 | 0.0 [0.0–0.7] | 35/35 | 410 | 0 | 0 |
| IDAE | 550 | 72.7 | 0.0 [0.0–0.7] | 35/35 | 115 | 22 | 25914 |

### iot — subamostra pareada (20/fase + 50 adversariais)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| Schema-Based | 150 | 16.7 | 0.0 [0.0–2.5] | 35/35 | 90 | — | — |
| IDAE | 150 | 53.3 | 0.0 [0.0–2.5] | 35/35 | 35 | — | — |
| LLM-Direct | 150 | 62.0 | 21.3 [15.5–28.6] | 25/35 | 0 | 150 | 76104 |
| LLM+Val+Retry | 150 | 62.0 | 14.7 [9.9–21.2] | 35/35 | 0 | 170 | 86613 |

Por fase (correto/n, corrupção):

| Abordagem | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| Schema-Based | 100/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 0/100 (0) | 5/50 (0) |
| IDAE | 100/100 (0) | 0/100 (0) | 100/100 (0) | 100/100 (0) | 100/100 (0) | 0/50 (0) |
| LLM-Direct | 18/20 (2) | 17/20 (3) | 14/20 (6) | 15/20 (5) | 17/20 (3) | 12/50 (13) |
| LLM+Val+Retry | 18/20 (2) | 17/20 (3) | 14/20 (6) | 15/20 (5) | 17/20 (3) | 12/50 (3) |

Fase adversarial por variante (IDAE | LLM-Direct | LLM+Val+Retry):

- sem-metrica: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- valor-NaN: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- outro-dominio: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- sem-timestamp: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 5 rej 0 fr 0 | ok 0 corr 0 rej 5 fr 0
- fora-de-faixa-9999C: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- umidade-140: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0 | ok 0 corr 0 rej 5 fr 0
- sem-zona: ok 0 corr 0 rej 5 fr 0 | ok 0 corr 5 rej 0 fr 0 | ok 0 corr 0 rej 5 fr 0
- aceita:pressao-kPa: ok 0 corr 0 rej 0 fr 5 | ok 2 corr 3 rej 0 fr 0 | ok 2 corr 3 rej 0 fr 0
- aceita:virgula-decimal: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0
- aceita:limite-critico: ok 0 corr 0 rej 0 fr 5 | ok 5 corr 0 rej 0 fr 0 | ok 5 corr 0 rej 0 fr 0

McNemar exato (decisão correta, IDAE vs LLM-Direct, subamostra): só IDAE acerta=26, só LLM-Direct acerta=29, p=0.788

Erros por campo — IDAE: {}; LLM-Direct: {"status":18,"value":4,"<should-reject>":10}; LLM+Val+Retry: {"status":18,"value":4}

## E3 — USGS (560 eventos reais)

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| IDAE [telos corrigido] | 560 | 100.0 | 0.0 [0.0–0.7] | 0/0 | 0 | 2 | 2654 |
| IDAE+ [telos corrigido] | 560 | 100.0 | 0.0 [0.0–0.7] | 0/0 | 0 | 4 | 5588 |
| LLM-Direct [telos corrigido] | 560 | 62.7 | 37.3 [33.4–41.4] | 0/0 | 0 | 560 | 324944 |
| IDAE [telos original] | 560 | 40.4 | 59.6 [55.5–63.6] | 0/334 | 0 | 5 | 6761 |
| LLM-Direct [telos original] | 560 | 2.0 | 98.0 [96.5–98.9] | 0/334 | 0 | 560 | 295386 |

| Abordagem | P1 | P2 | P3 | P4 | P5 | erros por campo |
|---|---|---|---|---|---|---|
| IDAE [telos corrigido] | 100/100 | 200/200 | 100/100 | 100/100 | 60/60 | {} |
| IDAE+ [telos corrigido] | 100/100 | 200/200 | 100/100 | 100/100 | 60/60 | {} |
| LLM-Direct [telos corrigido] | 13/100 | 200/200 | 6/100 | 99/100 | 33/60 | {"timestamp_utc":208,"place":1} |
| IDAE [telos original] | 100/100 | 0/200 | 96/100 | 0/100 | 30/60 | {"<should-reject>":334} |
| LLM-Direct [telos original] | 9/100 | 0/200 | 1/100 | 0/100 | 1/60 | {"timestamp_utc":215,"<should-reject>":334} |

Telos original — fabricação:

```json
{
 "IDAE [telos original]": {
  "csvAcceptedWithFabricatedSignificance": 330,
  "fabricatedValues": {
   "0": 327,
   "1": 2,
   "2": 1
  },
  "negativeDepthEvents": 11,
  "negativeDepthRejected": 0
 },
 "LLM-Direct [telos original]": {
  "csvAcceptedWithFabricatedSignificance": 330,
  "fabricatedValues": {
   "5": 2,
   "6": 2,
   "19": 1,
   "34": 1,
   "38": 1,
   "46": 2,
   "49": 1,
   "156": 1,
   "null": 319
  },
  "negativeDepthEvents": 11,
  "negativeDepthRejected": 0
 }
}
```

## E4 — Ablação

### financeiro

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| IDAE (original) | 550 | 90.9 | 0.9 [0.4–2.1] | 30/35 | 15 | 16 | 14035 |
| sem validator | 550 | 90.9 | 0.9 [0.4–2.1] | 30/35 | 15 | 17 | 14831 |
| validator ancorado | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 17 | 15019 |
| rejeição explícita | 550 | 92.7 | 0.9 [0.4–2.1] | 35/35 | 0 | 8 | 6896 |
| N-version (k=2) | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 22 | 19276 |
| IDAE+ (ancorado+rejeição+NV2) | 550 | 92.7 | 0.0 [0.0–0.7] | 35/35 | 5 | 25 | 21908 |
| sem amortização | 150 | 76.7 | 0.0 [0.0–2.5] | 35/35 | 0 | 220 | 187027 |

Adversarial por variante (ok/corrupção/rej.corr/rej.falsa):

- IDAE (original): sem-moeda=0/5/0/0; valor-zero=0/0/5/0; valor-negativo=0/0/5/0; sem-data=0/0/5/0; outro-dominio=0/0/5/0; valor-nao-numerico=0/0/5/0; moeda-desconhecida=0/0/5/0; aceita:moeda-minuscula-valor-string=0/0/0/5; aceita:numero-brasileiro=0/0/0/5; aceita:virada-de-dia-utc=0/0/0/5
- sem validator: sem-moeda=0/5/0/0; valor-zero=0/0/5/0; valor-negativo=0/0/5/0; sem-data=0/0/5/0; outro-dominio=0/0/5/0; valor-nao-numerico=0/0/5/0; moeda-desconhecida=0/0/5/0; aceita:moeda-minuscula-valor-string=0/0/0/5; aceita:numero-brasileiro=0/0/0/5; aceita:virada-de-dia-utc=0/0/0/5
- validator ancorado: sem-moeda=0/0/5/0; valor-zero=0/0/5/0; valor-negativo=0/0/5/0; sem-data=0/0/5/0; outro-dominio=0/0/5/0; valor-nao-numerico=0/0/5/0; moeda-desconhecida=0/0/5/0; aceita:moeda-minuscula-valor-string=0/0/0/5; aceita:numero-brasileiro=0/0/0/5; aceita:virada-de-dia-utc=0/0/0/5
- rejeição explícita: sem-moeda=0/0/5/0; valor-zero=0/0/5/0; valor-negativo=0/0/5/0; sem-data=0/0/5/0; outro-dominio=0/0/5/0; valor-nao-numerico=0/0/5/0; moeda-desconhecida=0/0/5/0; aceita:moeda-minuscula-valor-string=0/5/0/0; aceita:numero-brasileiro=5/0/0/0; aceita:virada-de-dia-utc=5/0/0/0
- N-version (k=2): sem-moeda=0/0/5/0; valor-zero=0/0/5/0; valor-negativo=0/0/5/0; sem-data=0/0/5/0; outro-dominio=0/0/5/0; valor-nao-numerico=0/0/5/0; moeda-desconhecida=0/0/5/0; aceita:moeda-minuscula-valor-string=0/0/0/5; aceita:numero-brasileiro=0/0/0/5; aceita:virada-de-dia-utc=0/0/0/5
- IDAE+ (ancorado+rejeição+NV2): sem-moeda=0/0/5/0; valor-zero=0/0/5/0; valor-negativo=0/0/5/0; sem-data=0/0/5/0; outro-dominio=0/0/5/0; valor-nao-numerico=0/0/5/0; moeda-desconhecida=0/0/5/0; aceita:moeda-minuscula-valor-string=0/0/0/5; aceita:numero-brasileiro=5/0/0/0; aceita:virada-de-dia-utc=5/0/0/0
- sem amortização: sem-moeda=0/0/5/0; valor-zero=0/0/5/0; valor-negativo=0/0/5/0; sem-data=0/0/5/0; outro-dominio=0/0/5/0; valor-nao-numerico=0/0/5/0; moeda-desconhecida=0/0/5/0; aceita:moeda-minuscula-valor-string=5/0/0/0; aceita:numero-brasileiro=5/0/0/0; aceita:virada-de-dia-utc=5/0/0/0

### iot

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| IDAE (original) | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 20 | 23876 |
| sem validator | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 20 | 23807 |
| validator ancorado | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 20 | 23343 |
| rejeição explícita | 550 | 93.6 | 0.0 [0.0–0.7] | 35/35 | 0 | 9 | 10749 |
| N-version (k=2) | 550 | 90.9 | 0.0 [0.0–0.7] | 35/35 | 15 | 25 | 29624 |
| IDAE+ (ancorado+rejeição+NV2) | 550 | 93.6 | 0.0 [0.0–0.7] | 35/35 | 0 | 30 | 35839 |
| sem amortização | 150 | 76.7 | 0.0 [0.0–2.5] | 35/35 | 0 | 220 | 255249 |

Adversarial por variante (ok/corrupção/rej.corr/rej.falsa):

- IDAE (original): sem-metrica=0/0/5/0; valor-NaN=0/0/5/0; outro-dominio=0/0/5/0; sem-timestamp=0/0/5/0; fora-de-faixa-9999C=0/0/5/0; umidade-140=0/0/5/0; sem-zona=0/0/5/0; aceita:pressao-kPa=0/0/0/5; aceita:virgula-decimal=0/0/0/5; aceita:limite-critico=0/0/0/5
- sem validator: sem-metrica=0/0/5/0; valor-NaN=0/0/5/0; outro-dominio=0/0/5/0; sem-timestamp=0/0/5/0; fora-de-faixa-9999C=0/0/5/0; umidade-140=0/0/5/0; sem-zona=0/0/5/0; aceita:pressao-kPa=0/0/0/5; aceita:virgula-decimal=0/0/0/5; aceita:limite-critico=0/0/0/5
- validator ancorado: sem-metrica=0/0/5/0; valor-NaN=0/0/5/0; outro-dominio=0/0/5/0; sem-timestamp=0/0/5/0; fora-de-faixa-9999C=0/0/5/0; umidade-140=0/0/5/0; sem-zona=0/0/5/0; aceita:pressao-kPa=0/0/0/5; aceita:virgula-decimal=0/0/0/5; aceita:limite-critico=0/0/0/5
- rejeição explícita: sem-metrica=0/0/5/0; valor-NaN=0/0/5/0; outro-dominio=0/0/5/0; sem-timestamp=0/0/5/0; fora-de-faixa-9999C=0/0/5/0; umidade-140=0/0/5/0; sem-zona=0/0/5/0; aceita:pressao-kPa=5/0/0/0; aceita:virgula-decimal=5/0/0/0; aceita:limite-critico=5/0/0/0
- N-version (k=2): sem-metrica=0/0/5/0; valor-NaN=0/0/5/0; outro-dominio=0/0/5/0; sem-timestamp=0/0/5/0; fora-de-faixa-9999C=0/0/5/0; umidade-140=0/0/5/0; sem-zona=0/0/5/0; aceita:pressao-kPa=0/0/0/5; aceita:virgula-decimal=0/0/0/5; aceita:limite-critico=0/0/0/5
- IDAE+ (ancorado+rejeição+NV2): sem-metrica=0/0/5/0; valor-NaN=0/0/5/0; outro-dominio=0/0/5/0; sem-timestamp=0/0/5/0; fora-de-faixa-9999C=0/0/5/0; umidade-140=0/0/5/0; sem-zona=0/0/5/0; aceita:pressao-kPa=5/0/0/0; aceita:virgula-decimal=5/0/0/0; aceita:limite-critico=5/0/0/0
- sem amortização: sem-metrica=0/0/5/0; valor-NaN=0/0/5/0; outro-dominio=0/0/5/0; sem-timestamp=0/0/5/0; fora-de-faixa-9999C=0/0/5/0; umidade-140=0/0/5/0; sem-zona=0/0/5/0; aceita:pressao-kPa=5/0/0/0; aceita:virgula-decimal=5/0/0/0; aceita:limite-critico=5/0/0/0

## E6 — Índice de Resolução (H_r) e TTL

H_r (fração de campos errados vs. oráculo) por tentativa, apenas registros aceitáveis:

| Tentativa | tentativas | H_r médio | aprovadas no validator | aprovadas c/ H_r>0 (validator aprovou erro) |
|---|---|---|---|---|
| 1 | 557 | 0.000 | 557 | 0 |

Sínteses sobre registros aceitáveis: 557. Convergência (validator) em ≤k tentativas:
- TTL=1: 95.7%
- TTL=2: 95.7%
- TTL=3: 95.7%

| Variante | sínteses (reg. aceitáveis) | conv. na 1ª | na 2ª | na 3ª | não convergiu |
|---|---|---|---|---|---|
| N-version (k=2) | 20 | 20 | 0 | 0 | 0 |
| rejeição explícita | 10 | 10 | 0 | 0 | 0 |
| sem validator | 10 | 10 | 0 | 0 | 0 |
| IDAE (original) | 71 | 71 | 0 | 0 | 0 |
| IDAE+ (ancorado+rejeição+NV2) | 20 | 20 | 0 | 0 | 0 |
| validator ancorado | 10 | 10 | 0 | 0 | 0 |
| IDAE sem validator | 60 | 60 | 0 | 0 | 0 |
| IDAE+ | 126 | 126 | 0 | 0 | 0 |

Sínteses disparadas por registros que deveriam ser rejeitados: 385; delas, o validator aprovou algum programa em 7 (programa que "inventa" uma saída válida).

## E5 — Repetições independentes

### financeiro (R=6)

| Abordagem | Correto % (média±dp) | Corrupção % | Rej. falsa % | Corrupção adversarial % | Chamadas |
|---|---|---|---|---|---|
| IDAE (original) | 89.3±0.0 | 0.2±0.4 | 3.2±0.0 | 1.7±4.1 | 16.8±1.0 |
| IDAE+ | 92.5±0.0 | 0.0±0.0 | 0.0±0.0 | 0.0±0.0 | 20.5±1.0 |
| IDAE sem validator | 89.3±0.0 | 0.2±0.4 | 3.2±0.0 | 1.7±4.1 | 16.7±0.8 |
| LLM-Direct (só P6) | — | 0.0±0.0 | 0.0±0.0 | 0.0±0.0 | 30.0±0.0 |

| Comparação (pareada por execução) | Wilcoxon exato p | δ de Cliff |
|---|---|---|
| corrupção adversarial: LLM-Direct vs IDAE | 1.00 (n≠0=1) | -0.17 |
| corrupção: IDAE sem validator vs IDAE | 1.00 (n≠0=0) | 0.00 |
| corrupção: IDAE vs IDAE+ | 1.00 (n≠0=1) | 0.17 |
| correto: IDAE+ vs IDAE | 0.0313 (n≠0=6) | 1.00 |
| rej. falsa: IDAE vs IDAE+ | 0.0313 (n≠0=6) | 1.00 |
| chamadas: IDAE+ vs IDAE | 0.0313 (n≠0=6) | 1.00 |

### iot (R=6)

| Abordagem | Correto % (média±dp) | Corrupção % | Rej. falsa % | Corrupção adversarial % | Chamadas |
|---|---|---|---|---|---|
| IDAE (original) | 89.3±0.0 | 0.0±0.0 | 3.2±0.0 | 0.0±0.0 | 20.0±0.0 |
| IDAE+ | 92.5±0.0 | 0.0±0.0 | 0.0±0.0 | 0.0±0.0 | 22.0±0.0 |
| IDAE sem validator | 89.3±0.0 | 0.0±0.0 | 3.2±0.0 | 0.0±0.0 | 20.0±0.0 |
| LLM-Direct (só P6) | — | 0.6±1.4 | 0.0±0.0 | 0.6±1.4 | 30.0±0.0 |

| Comparação (pareada por execução) | Wilcoxon exato p | δ de Cliff |
|---|---|---|
| corrupção adversarial: LLM-Direct vs IDAE | 1.00 (n≠0=1) | 0.17 |
| corrupção: IDAE sem validator vs IDAE | 1.00 (n≠0=0) | 0.00 |
| corrupção: IDAE vs IDAE+ | 1.00 (n≠0=0) | 0.00 |
| correto: IDAE+ vs IDAE | 0.0313 (n≠0=6) | 1.00 |
| rej. falsa: IDAE vs IDAE+ | 0.0313 (n≠0=6) | 1.00 |
| chamadas: IDAE+ vs IDAE | 0.0313 (n≠0=6) | 1.00 |

## E7 — Deriva gradual e validator mal-especificado

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| **deriva 80.0% sem moeda** | | | | | | | |
| IDAE (original) #1 | 100 | 20.0 | 0.0 [0.0–3.7] | 80/80 | 0 | 4 | 3581 |
| IDAE + rejeição explícita #1 | 100 | 20.0 | 0.0 [0.0–3.7] | 80/80 | 0 | 2 | 1661 |
| LLM-Direct | 100 | 20.0 | 0.0 [0.0–3.7] | 80/80 | 0 | 100 | 37431 |
| IDAE (original) #2 | 100 | 21.0 | 0.0 [0.0–3.7] | 79/79 | 0 | 4 | 3453 |
| IDAE + rejeição explícita #2 | 100 | 21.0 | 0.0 [0.0–3.7] | 79/79 | 0 | 2 | 1685 |
| IDAE (original) #3 | 100 | 11.0 | 0.0 [0.0–3.7] | 89/89 | 0 | 4 | 3665 |
| IDAE + rejeição explícita #3 | 100 | 11.0 | 0.0 [0.0–3.7] | 89/89 | 0 | 2 | 1914 |
| **deriva 50.0% sem moeda** | | | | | | | |
| IDAE (original) #1 | 100 | 53.0 | 0.0 [0.0–3.7] | 47/47 | 0 | 4 | 3452 |
| IDAE + rejeição explícita #1 | 100 | 53.0 | 0.0 [0.0–3.7] | 47/47 | 0 | 2 | 1662 |
| LLM-Direct | 100 | 53.0 | 0.0 [0.0–3.7] | 47/47 | 0 | 100 | 38438 |
| IDAE (original) #2 | 100 | 53.0 | 0.0 [0.0–3.7] | 47/47 | 0 | 4 | 3682 |
| IDAE + rejeição explícita #2 | 100 | 53.0 | 0.0 [0.0–3.7] | 47/47 | 0 | 2 | 1832 |
| IDAE (original) #3 | 100 | 57.0 | 0.0 [0.0–3.7] | 43/43 | 0 | 4 | 3358 |
| IDAE + rejeição explícita #3 | 100 | 57.0 | 0.0 [0.0–3.7] | 43/43 | 0 | 2 | 1700 |
| **deriva 20.0% sem moeda** | | | | | | | |
| IDAE (original) #1 | 100 | 78.0 | 0.0 [0.0–3.7] | 22/22 | 0 | 4 | 3323 |
| IDAE + rejeição explícita #1 | 100 | 78.0 | 0.0 [0.0–3.7] | 22/22 | 0 | 2 | 1765 |
| LLM-Direct | 100 | 78.0 | 0.0 [0.0–3.7] | 22/22 | 0 | 100 | 39216 |
| IDAE (original) #2 | 100 | 75.0 | 25.0 [17.5–34.3] | 0/25 | 0 | 2 | 1667 |
| IDAE + rejeição explícita #2 | 100 | 75.0 | 0.0 [0.0–3.7] | 25/25 | 0 | 2 | 1592 |
| IDAE (original) #3 | 100 | 80.0 | 0.0 [0.0–3.7] | 20/20 | 0 | 4 | 3383 |
| IDAE + rejeição explícita #3 | 100 | 80.0 | 0.0 [0.0–3.7] | 20/20 | 0 | 2 | 1723 |
| **deriva 5.0% sem moeda** | | | | | | | |
| IDAE (original) #1 | 100 | 93.0 | 0.0 [0.0–3.7] | 7/7 | 0 | 4 | 3448 |
| IDAE + rejeição explícita #1 | 100 | 93.0 | 0.0 [0.0–3.7] | 7/7 | 0 | 2 | 1686 |
| LLM-Direct | 100 | 93.0 | 0.0 [0.0–3.7] | 7/7 | 0 | 100 | 39667 |
| IDAE (original) #2 | 100 | 96.0 | 4.0 [1.6–9.8] | 0/4 | 0 | 2 | 1691 |
| IDAE + rejeição explícita #2 | 100 | 96.0 | 0.0 [0.0–3.7] | 4/4 | 0 | 2 | 1622 |
| IDAE (original) #3 | 100 | 95.0 | 0.0 [0.0–3.7] | 5/5 | 0 | 4 | 3565 |
| IDAE + rejeição explícita #3 | 100 | 95.0 | 0.0 [0.0–3.7] | 5/5 | 0 | 2 | 1700 |

Parte B (telos mal-especificado; registro válido primeiro):

| Abordagem | n | Correto % | Corrupção % [IC95] | Rej. corretas | Rej. falsas | Chamadas | Tokens~ |
|---|---|---|---|---|---|---|---|
| IDAE telos permissivo | 30 | 33.3 | 66.7 [48.8–80.8] | 0/20 | 0 | 1 | 672 |
| IDAE telos correto | 30 | 3.3 | 0.0 [0.0–11.4] | 20/20 | 9 | 4 | 3569 |
| IDAE telos permissivo (Haiku 4.5) | 30 | 33.3 | 66.7 [48.8–80.8] | 0/20 | 0 | 1 | 748 |
| IDAE telos correto (Haiku 4.5) | 30 | 3.3 | 0.0 [0.0–11.4] | 20/20 | 9 | 4 | 3384 |
- IDAE telos permissivo: valido: ok 10, corrupção 0, rej 0, rej.falsa 0; negativo: ok 0, corrupção 10, rej 0, rej.falsa 0; zero: ok 0, corrupção 10, rej 0, rej.falsa 0
- IDAE telos correto: valido: ok 1, corrupção 0, rej 0, rej.falsa 9; negativo: ok 0, corrupção 0, rej 10, rej.falsa 0; zero: ok 0, corrupção 0, rej 10, rej.falsa 0
- IDAE telos permissivo (Haiku 4.5): valido: ok 10, corrupção 0, rej 0, rej.falsa 0; negativo: ok 0, corrupção 10, rej 0, rej.falsa 0; zero: ok 0, corrupção 10, rej 0, rej.falsa 0
- IDAE telos correto (Haiku 4.5): valido: ok 1, corrupção 0, rej 0, rej.falsa 9; negativo: ok 0, corrupção 0, rej 10, rej.falsa 0; zero: ok 0, corrupção 0, rej 10, rej.falsa 0

