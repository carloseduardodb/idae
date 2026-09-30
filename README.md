# IDAE — Intent-Driven Adaptive Extraction

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23050792.svg)](https://doi.org/10.5281/zenodo.23050792)

Artigo: *Programas Descartáveis sob Especificação Imutável: o que um Validator
Realmente Garante — um Estudo com Extração de Dados* —
[doi.org/10.5281/zenodo.23050792](https://doi.org/10.5281/zenodo.23050792)
(PDF e fonte LaTeX em `article/old/`).

Autor: Carlos Eduardo Dias Batista — ORCID [0009-0005-5726-0289](https://orcid.org/0009-0005-5726-0289)

Implementação e avaliação experimental do IDAE, com oráculo de verdade-terreno.
O IDAE sintetiza, com um LLM, programas de extração descartáveis sob uma
especificação imutável (o *telos*) e os reutiliza por formato de entrada.
A avaliação usa **Claude Opus 4.5** como modelo principal e **Claude Haiku 4.5** como modelo menor
(análise de sensibilidade).

## Por que esta avaliação

A leitura do código de uma avaliação preliminar do IDAE mostrou problemas de
medição que invalidam parte das suas conclusões:

| # | Problema no código original | Consequência |
|---|---|---|
| 1 | A alucinação só era medida para o LLM-Direct; o runner do IDAE nunca chamava o detector | "0% de alucinação do IDAE" era verdadeiro por construção, não medido |
| 2 | O "LLM-Direct" também sintetizava código, com cache por assinatura e o **mesmo validator** | O baseline não era "LLM por registro"; as 186 chamadas no USGS vinham da assinatura por contagem de vírgulas |
| 3 | O telos do USGS exigia `significance` inteiro, mas o CSV do USGS não tem `sig` | Os 96,5% de validade no CSV incluíam valores fabricados |
| 4 | As 7 rejeições no USGS foram atribuídas a "magnitude nula" | Nenhum dos 560 eventos tem magnitude nula; eram profundidades negativas (válidas) |
| 5 | Na ablação, "Sem Phase 2" tinha código idêntico a "IDAE completo" | A diferença reportada era variância do LLM |
| 6 | O Exp-C1 condensado parava na primeira falha (4.001/5.000, só o caminho [1,2,3,4]) | Os três caminhos citados vinham do exp-03, não do C1 |
| 7 | O Wilcoxon comparava uma série de zeros "por construção" | O p = 0,005 não testava a hipótese declarada |

## O que muda nesta avaliação

* **Oráculo por registro.** Todo registro gerado carrega a verdade-terreno: a saída exata esperada ou "deve ser rejeitado".
  A mesma métrica vale para **todas** as abordagens:
  `correto`, `corrupção silenciosa` (aceito e diferente da verdade, ou aceito quando deveria ser rejeitado),
  `rejeição correta` e `rejeição falsa`.
* **Mesma especificação para todos.** IDAE, LLM-Direct e LLM+Val+Retry recebem o mesmo texto de telos, incluindo a regra de rejeição.
* **LLM-Direct real.** Uma chamada por registro, sem validator.
* **Dados reprodutíveis.** PRNG com semente, fuso fixo (`TZ=America/Sao_Paulo`) e log JSONL de cada prompt e resposta.
* **Estatística exata.** Wilcoxon signed-rank exato, McNemar exato, IC de Wilson e δ de Cliff.

## Estrutura

```
idae/
├── src/
│   ├── llm-client.js         cliente LLM (API da Anthropic) com seleção de modelo, sem dependências
│   ├── util.js               PRNG, sandbox (vm + timeout), limpeza de código, pool
│   ├── metrics.js            classificação contra o oráculo
│   ├── stats.js              Wilcoxon/McNemar exatos, Wilson, Cliff
│   ├── harness.js            fluxos, execução, persistência
│   ├── domains/              financial.js · iot.js · usgs.js (geradores + oráculo + validators)
│   ├── approaches/index.js   IDAE (+ variantes), LLM-Direct, LLM+Val+Retry, Schema-Based
│   └── chain/index.js        IDAE com cadeia de 4 intenções, compressão e Fase 2 (porte do C1)
├── experiments/              e1…e7 + report.js + smoke.js
├── tests/unit.test.js        25 testes sem LLM (oráculo, validators, estatística, mecânica do IDAE)
├── data/usgs/                os mesmos 560 eventos reais do Exp-C5
├── results/                  JSON por experimento, RESUMO.md, logs/*.jsonl (prompts e respostas)
└── article/                  artigo em LaTeX (+ classe ACM)
```

## Experimentos

| ID | Reavalia | Pergunta |
|---|---|---|
| E1 | Exp-C1 | A cadeia de 4 intenções com compressão e Fase 2 entrega o telos **correto**? |
| E2 | Exps. 2–3 | IDAE vs Schema-Based, LLM-Direct e LLM+Val+Retry, com oráculo, em 2 domínios (Opus 4.5 e Haiku 4.5) |
| E3 | Exp-C5 | Dados reais do USGS: telos corrigido vs telos original (fabricação) |
| E4 | Exp-C6 | Ablação: sem validator, sem amortização, validator ancorado, rejeição explícita, N-version |
| E5 | Exp-C4 | 6 repetições independentes por domínio, com testes exatos |
| E6 | Exp-C7 | H_r medido contra o oráculo por tentativa; sensibilidade de TTL (a partir dos traços de E4/E5) |
| E7 | Exp-C3 | Deriva gradual (moeda ausente em 5–80%) e telos mal-especificado |

## Como rodar

Pré-requisitos: Node ≥ 22 e `ANTHROPIC_API_KEY` definida. Não há dependências npm.

```bash
npm test                       # testes unitários (sem LLM)
npm run smoke                  # poucas chamadas reais para validar prompts
TZ=America/Sao_Paulo IDAE_LLM_LOG=results/logs/e2.jsonl npm run e2
LLM_MODEL=claude-haiku-4.5 npm run e2      # sensibilidade ao modelo
npm run e1; npm run e3; npm run e4; npm run e5; npm run e7
npm run report                 # gera results/RESUMO.md (inclui E6)
```

Variáveis: `ANTHROPIC_API_KEY`, `LLM_MODEL` (padrão `claude-opus-4.5`), `IDAE_LLM_LOG` (JSONL de auditoria),
`N`, `NADV`, `SUB`, `SEED`, `R`, `REPS`, `CONC`.

`results/descartados/` guarda os logs de uma execução interrompida de E4/E5/E7,
feita antes da correção da amortização da rejeição (ver seção de ameaças do artigo).
