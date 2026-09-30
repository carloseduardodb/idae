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

## Como a avaliação mede

* **Oráculo por registro.** Todo registro gerado carrega a verdade-terreno: a saída exata esperada ou "deve ser rejeitado".
  A mesma métrica vale para **todas** as abordagens:
  `correto`, `corrupção silenciosa` (aceito e diferente da verdade, ou aceito quando deveria ser rejeitado),
  `rejeição correta` e `rejeição falsa`.
* **Mesma especificação para todos.** IDAE, LLM-Direct e LLM+Val+Retry recebem o mesmo texto de telos, incluindo a regra de rejeição.
* **LLM-Direct.** Uma chamada por registro, sem validator.
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
│   └── chain/index.js        IDAE com cadeia de 4 intenções, compressão e Fase 2
├── experiments/              e1…e7 + report.js + smoke.js
├── tests/unit.test.js        25 testes sem LLM (oráculo, validators, estatística, mecânica do IDAE)
├── data/usgs/                560 eventos reais do USGS Earthquake Catalog
├── results/                  JSON por experimento, RESUMO.md, logs/*.jsonl (prompts e respostas)
└── article/                  artigo em LaTeX (+ classe ACM)
```

## Experimentos

| ID | Pergunta |
|---|---|
| E1 | A cadeia de 4 intenções com compressão e Fase 2 entrega o telos **correto**? |
| E2 | IDAE vs Schema-Based, LLM-Direct e LLM+Val+Retry, com oráculo, em 2 domínios (Opus 4.5 e Haiku 4.5) |
| E3 | Dados reais do USGS: telos corrigido vs telos original (fabricação) |
| E4 | Ablação: sem validator, sem amortização, validator ancorado, rejeição explícita, N-version |
| E5 | 6 repetições independentes por domínio, com testes exatos |
| E6 | H_r medido contra o oráculo por tentativa; sensibilidade de TTL (a partir dos traços de E4/E5) |
| E7 | Deriva gradual (moeda ausente em 5–80%) e telos mal-especificado |

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
