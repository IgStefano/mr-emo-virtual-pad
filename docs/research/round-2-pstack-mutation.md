# Segunda rodada: pstack, mutação desde dia zero e arquitetura verificável

Pesquisa em 2026-11-13. Escopo: revisão e recomendações, sem implementação do app, instalação de plugin ou configuração. Contexto lido: `architecture-proposal.md`. **Fato** indica comportamento documentado/código inspecionado; **recomendação** indica escolha proposta para este projeto; **ressalva** delimita a evidência. Não executei as suítes externas nem um spike Electron.

## Resultado principal

**Recomendação:** manter as camadas propostas, mas transformar sua direção de dependências, localização dos efeitos e contratos em checks executáveis desde o primeiro incremento. Adotar StrykerJS junto do primeiro comportamento, não depois de alcançar cobertura. A unidade de progresso deve ser requisito observável + teste que detecta violação + evidência reproduzível. Não usar quantidade de regras ou score como substitutos de qualidade.

O requisito central de lint é governar como se escreve código: caminho aprovado fácil, violação difícil, mensagem com correção concreta. ESLint não é apenas formatter nem detector de slop. Mutação complementa esse governo: verifica sensibilidade dos testes a determinadas alterações, não intenção do produto.

V1 considerada: aproximadamente 20–30 músicas sem teto arbitrário; um arquivo por pad; clique inicia do zero; STOP obrigatório antes de trocar; clique durante reprodução ignorado; edição somente parada; importação cria cópia; exclusão apaga somente cópia interna. Biblioteca/repertórios futuros não justificam antecipar toda a infraestrutura.

## 1. O pstack real

### Evidência e versão

Inspecionei diretamente a árvore solicitada por API GitHub e clone, porque a abertura web da página foi bloqueada. Snapshot `cursor/plugins` **05b49176bc9e00d8e9e3dbf136fa76631cd6468a**; `pstack/plugin.json` declara **0.15.36**. [Manifesto fixado](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/plugin.json). Os links abaixo fixam esse snapshot, evitando atribuir a versões futuras o conteúdo observado.

**Fato:** `poteto-mode` é principalmente instrução de workflow, roteamento para skills e playbooks, princípios e convenções para agentes. Seu frontmatter usa `disable-model-invocation: true`. Determina como investigar, escolher estrutura de dados, produzir evidência e revisar; faz referências a agentes/modelos e ferramentas. Isso não é um compilador de arquitetura ou um monitor que impede violações em runtime. [Código da skill](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/poteto-mode/SKILL.md).

Mecanismos concretos encontrados:

- **Harness verificável por projeto.** `create-verification-skill` pede descobrir Surface, Run, Drive, Observe e Isolate a partir do repo. Gera Launch, Doctor, Drive, Evidence, Cleanup e Helpers, mais mapa de features. Exige caminho real de usuário e efeitos laterais; captura deve sobreviver ao cleanup. Deve executar uma feature de ponta a ponta antes de entregar a skill. Isso é uma especificação operacional para o agente construir o harness, não um harness Electron pronto. [Fonte](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/create-verification-skill/SKILL.md).
- **Manutenção da prova.** `maintain-verification-skill` exige executar features ao vivo, doctor após comportamento surpreendente e preservação dos artefatos; distingue drift do harness de defeito. [Fonte](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/maintain-verification-skill/SKILL.md).
- **Verificador do próprio plano.** `check-plan.mjs` lê Markdown e verifica estrutura e marcadores: blocos unit/live/perf, gates e dez lanes, entre outros. É código executável, mas valida formato/existência textual dos compromissos; não demonstra que o screenshot representa execução válida, que o teste corresponde à spec ou que a medição é correta. Não copiar sua exigência de dez lanes para um pad pequeno. [Script](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/poteto-mode/scripts/check-plan.mjs).
- **Verificação formal delimitada.** `create-formal-verification-skill` escolhe uma propriedade de alto risco; pede correspondência entre passos atômicos do modelo e código, versão reproduzível, escopo e limites explícitos, registro de arquivos/funções e commit de sincronização. Exige demonstrar falha numa variante quebrada e não enfraquecer a propriedade diante de um contraexemplo. Isso inspira diretamente um controle de sensibilidade dos testes. [Fonte](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/create-formal-verification-skill/SKILL.md).
- **Statechart implementado.** A skill descreve wrapper de TLC/TLA+ com runtime TypeScript, instalação inicial de Java/TLC via mise e rede; produz relatório e Mermaid a partir do modelo. Declara limites de estados, regras não verificadas e necessidade de reproduzir contraexemplos no código real. Um modelo aprovado não prova implementação, Chromium, disco ou áudio. [Skill e scripts](https://github.com/cursor/plugins/tree/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/statechart).
- **Observabilidade como investigação.** Runtime forensics pede perfil/heap/CDP trace, redução à causa, experimento ao vivo e atribuição ao símbolo; trace forensics trabalha sobre captura fixa, consulta dados e separa hipótese de confirmação por captura pareada. Não encontrei nesses fluxos um SDK de observabilidade automaticamente instalado no app. [Runtime](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/poteto-mode/playbooks/runtime-forensics.md), [trace](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/poteto-mode/playbooks/trace-forensics.md).

**Ressalva sobre contratos/proof:** o material inspecionado estabelece obrigações de evidência, invariantes e mapas de features. Não encontrei nesses arquivos um gerador geral de contratos IPC, uma integração Stryker pronta ou prova automática da aplicação Electron. Não atribuir essas capacidades ao nome pstack. “Proof” nesse contexto pode ser evidência operacional; só é prova formal no escopo explicitamente modelado/verificado.

### O que depende do ambiente e o que aproveitar sem instalar

**Fato:** o fluxo poteto referencia `Task`, tipo `poteto-agent`, modelos configuráveis, regras/skills Cursor e `control-ui`, `control-cli`, `deslop` de `cursor-team-kit`. Essas integrações não passam a existir ao copiar um Markdown. Captura CDP, execução de comandos, GitHub e verificadores formais precisam de ferramentas e permissões reais. [Dependências descritas no workflow](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/poteto-mode/SKILL.md).

**Recomendação sem plugin:** manter uma receita de verificação no repo, utilizável por qualquer agente, apontada por instruções curtas. Cada mudança declara requisito, fronteira afetada, comando, fixture e artefato. O agente executa comandos do projeto e apresenta evidência com SHA; reviewer verifica tanto comportamento como adequação do teste. Nenhum comando slash é necessário. Não transformar recomendações externas de autonomia em autorização para publicar ou apagar dados.

Receita futura do pad: lançar build identificado com diretório de dados descartável; doctor confirma versão, perfil e estado inicial parado; dirigir por seletores acessíveis; verificar resultado visível e conteúdo em disco; guardar logs/trace/relatórios fora do scratch; encerrar apenas processos criados. Manter mapa de features para tocar/STOP, editar, importar, excluir e recuperar falhas. Harness que ainda não rodou é rascunho.

## 2. StrykerJS e Vitest: estado observado

**Fato/versionamento:** registro npm consultado retornou `@stryker-mutator/vitest-runner` **10.1.1**, Node **>=22**, peer Vitest **>=2.0.0** e core **10.1.1**. No código `master` inspecionado, commit **8f24ef0be3a2119fc44ac48bfce58930ab2c9032**, package.json também declara 10.1.1 e usa Vitest **4.1.12** como dependência de desenvolvimento. Isso é evidência da combinação usada upstream, não certificação de todo Vitest aceito pelo peer. [npm](https://registry.npmjs.org/@stryker-mutator%2fvitest-runner/latest), [package fixado](https://github.com/stryker-mutator/stryker-js/blob/8f24ef0be3a2119fc44ac48bfce58930ab2c9032/packages/vitest-runner/package.json).

**Recomendação:** no scaffold, fixar versões exatas compatíveis de core/runner, Vitest, Node e TypeScript, registrar lockfile e executar uma prova mínima Windows/Mac. Node dos checks é ferramenta de desenvolvimento, não deve ser confundido com o Node embutido no Electron. Ainda não existe matriz validada deste app.

**Fato:** o runner usa análise por teste, procura testes relacionados por imports e controla paralelismo/bail/watch/cobertura para trabalhar com os workers Stryker. `vitest.related: false` é necessário quando a relação não aparece no grafo, por exemplo chamada indireta a outro processo. Ele não mede automaticamente mutantes de código executado fora de seu processo/contexto instrumentado. [Documentação](https://stryker-mutator.io/docs/stryker-js/vitest-runner/), [implementação](https://github.com/stryker-mutator/stryker-js/blob/8f24ef0be3a2119fc44ac48bfce58930ab2c9032/packages/vitest-runner/src/vitest-test-runner.ts).

**Divergência importante:** a página oficial ainda afirma não suportar Browser Mode e menciona `threads: true`, enquanto também documenta opções de pool recentes. O snapshot do código contém suíte `browser-mode.it.spec.ts` que verifica cobertura, kill/survive, mutante estático e supressão de screenshots; sua fixture usa provider Playwright/Chromium headless. Portanto “Browser Mode nunca suportado” seria conclusão incorreta sobre o código atual. Também seria incorreto concluir que isso cobre e2e Electron ou todas as versões publicadas. Antes de usar essa via, executar spike na combinação pinada e comparar pacote distribuído com fonte; a recomendação inicial continua mutar domínio/controladores/adapters testáveis em Node. [Teste real](https://github.com/stryker-mutator/stryker-js/blob/8f24ef0be3a2119fc44ac48bfce58930ab2c9032/packages/vitest-runner/test/integration/browser-mode.it.spec.ts), [fixture](https://github.com/stryker-mutator/stryker-js/blob/8f24ef0be3a2119fc44ac48bfce58930ab2c9032/packages/vitest-runner/testResources/browser-project/vitest.config.js).

### Incremental, arquivos alterados e execução integral

**Fato:** `npx stryker run --incremental` reutiliza o relatório anterior e compara código/testes; ainda faz dry run. Não equivale a diff Git. Alterações em arquivos externos, dependências e configuração podem escapar da invalidação baseada em fonte/testes. [Modo incremental e ressalvas](https://stryker-mutator.io/docs/stryker-js/incremental/).

**Recomendação:** começar com execução completa em toda PR enquanto o núcleo for pequeno; oferecer incremental local desde o início. Ao crescer, cache versionado por lockfile/config/Node/SO e PR incremental mais execução integral periódica e pré-release. Nunca reutilizar cache de origem desconhecida como evidência confiável. Mudou contrato transversal, regra de teste, fixture, ferramenta ou dependência? Invalidar cache e rodar completo.

`npx stryker run --mutate "src/domain/playback.ts"` é recorte explícito para investigação. **Fato:** argumentos CLI substituem a opção inteira correspondente, não somam ao glob da configuração. [Configuração](https://stryker-mutator.io/docs/stryker-js/configuration/). **Recomendação:** se houver comando changed-files futuro, usar merge-base com base explícita e gerar lista segura via script Node, considerando arquivos novos, renomes e testes alterados; mudança só em teste também pode exigir remutar fontes. Não usar interpolação shell improvisada, nem tratar resultado parcial como score global.

### Operadores, resultados e limites

**Fato:** StrykerJS oferece alterações de booleanos, condicionais, igualdade, lógica, aritmética, blocos, arrays/objetos, strings, métodos, optional chaining, regex e operadores de atualização/unários. Não promete gerar todo bug imaginável; por exemplo, inversões arbitrárias da ordem de mensagens não são o objetivo dessa lista de operadores. [Tabela oficial](https://stryker-mutator.io/docs/mutation-testing-elements/supported-mutators/).

**Fato:** Killed significa teste falhou; Survived significa passou; NoCoverage indica ausência de execução. Timeout também conta como detectado; CompileError/RuntimeError não são evidência equivalente a uma asserção correta de comportamento. O score é a proporção de detectados entre mutantes válidos considerados, não porcentagem de requisitos provados. [Estados e métricas](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/).

**Recomendação para triagem:**

1. Survivor: identificar efeito observável e requisito. Falta cenário/assertion? Adicionar caso que falhe por uma razão de produto. Código redundante? Simplificar se preservar comportamento. Contrato ambíguo? Resolver spec, não adivinhar para matar mutante.
2. Equivalente: explicar por que nenhuma entrada válida distingue o mutante, sob quais invariantes. “Difícil matar” não prova equivalência. Preferir remoção da redundância ou exceção localizada revisada.
3. NoCoverage: conferir descoberta/imports antes de simplesmente escrever teste. Pode ser fonte fora do escopo testável ou configuração quebrada.
4. Timeout: reproduzir isolado, conferir baseline, workers e vazamentos. Se a mutação causa loop infinito real, é detecção válida; se apenas máquina lenta, não celebrar como teste forte. Registrar quantos kills vieram de timeout.
5. Erros: inspecionar separadamente. Checker TypeScript pode filtrar mutantes inválidos; exige plugin e custo próprio. Não substituir typecheck normal por checker de mutação.

**Fato:** `thresholds.high/low` orientam apresentação; `break` define falha do processo, e o padrão `break: null` não bloqueia score baixo. Timeout usa duração de baseline, fator e margem absoluta. [Opções](https://stryker-mutator.io/docs/stryker-js/configuration/). **Recomendação:** núcleo crítico com meta inicial `high:100, low:100, break:100`, desde que triados equivalentes e ignorados e que haja mutantes efetivos. É política para conjunto pequeno e explícito, não prova de perfeição. Acrescentar módulos ao escopo por responsabilidade, não escolhendo arquivos fáceis; reportar arquivos fora do escopo, contagens e ignorados. Se uma meta distinta for necessária, decisão por módulo e justificativa concreta, sem reduzir threshold silenciosamente para liberar PR. Uma execução com zero mutantes não satisfaz o gate.

**Fato:** Stryker permite exclusão de operadores, comentários `Stryker disable` e ignore-plugin; ignorados continuam no relatório, fora do score. [Mecanismos](https://stryker-mutator.io/docs/stryker-js/disable-mutants/). **Recomendação:** não desligar StringLiteral/EqualityOperator globalmente; strings podem ser canais IPC e igualdade pode guardar geração. Exceção mínima com operador/trecho, razão, prova de equivalência ou risco aceito, responsável e gatilho de revisão. Mudanças na lista de exclusões e thresholds recebem revisão como mudança de contrato. Escape hatch emergencial deve registrar dívida e prazo, nunca marcar comportamento como verificado.

## 3. Plano concreto desde dia zero

Tudo nesta seção é **recomendação futura**, não comando/config já existente no repo.

### Primeiro incremento: um comportamento e sua verificação

No primeiro commit com lógica, entregar máquina de reprodução mínima e controlador com portas explícitas para concessão e áudio; testes Vitest e Stryker juntos. Sem criar módulos vazios para inflar escopo. Incluir `src/domain`, contratos com validação executável e os controladores/adapters escritos no conjunto mutável; excluir testes, gerados, declarações e bootstrap puramente declarativo com lista documentada. Não excluir adapter só por ser adapter: regras de protocolo, seleção de arquivo ou recuperação são lógica relevante.

Proposta de configuração documental, a materializar e validar no scaffold:

```json
{
  "testRunner": "vitest",
  "vitest": { "configFile": "vitest.mutation.config.ts", "related": false },
  "mutate": ["src/domain/**/*.ts", "src/contracts/**/*.ts", "src/renderer/playback/**/*.ts", "src/main/library/**/*.ts", "src/main/storage/**/*.ts", "src/main/ipc/**/*.ts", "src/main/media/**/*.ts"],
  "reporters": ["clear-text", "progress", "html", "json"],
  "thresholds": { "high": 100, "low": 100, "break": 100 },
  "incremental": false,
  "concurrency": 2
}
```

Escolha `related:false` inicial reduz risco de seleção indevida, com custo aceitável para suíte pequena. A config Vitest proposta deve selecionar apenas suítes que executam o código no ambiente instrumentado e separar e2e Electron. Validar nomes/opções contra schema da versão pinada. Threshold não detecta glob vazio sozinho: conferir inventário e contagem mínima real, com falha explícita se fonte crítica ficou fora.

### Testes que têm razão para matar mutantes

| Contrato do produto | Cenário e oráculo independente | Alteração que deve ser detectada |
|---|---|---|
| Novo clique começa do zero | Tocar A, avançar cursor fake, STOP, tocar A; posição inicial da nova sessão é zero | Remoção do reset/bloco de inicialização, se gerada; validar também com variante deliberada |
| Clique ocupado não troca | A em aquisição/início/reprodução; clicar B; faixa ativa permanece A, nenhum início B | Condição invertida, booleano/igualdade trocado |
| STOP invalida tentativa | Segurar concessão A, STOP, iniciar B, resolver concessão A; resolver/rejeitar play antigo e emitir ended/error antigo | Remoção/inversão do guard de geração ou incremento alterado |
| Apenas um acesso ao acervo | Adquirir reprodução e tentar editar/importar/excluir, inclusive enquanto diálogo está pendente | Guarda removida ou condição sempre verdadeira |
| Edição falha sem alterar acervo | Importação iniciada e segundo comando concorrente; verificar revisão/conteúdo e resultado de rejeição | Eliminação de reserva ou verificação |
| Copiar preserva original | Importar fixture externa em temp dir, comparar bytes, excluir pad, reiniciar e conferir original intacto e cópia removida | Caminho/tipo de operação alterado, limpeza eliminada; nem todo erro será gerado automaticamente |
| Publicação segura | Falhar cópia, validação, promoção e persistência separadamente; reabrir acervo e inspecionar referências | Condicional/bloco de rollback alterado; crash entre passos exige injeção própria |
| Exclusão recuperável | Falhar unlink após persistir remoção; reiniciar duas vezes; pad não reaparece e pendência converge | Remoção do registro/retry, comparação invertida |
| Contrato IPC fechado | ID desconhecido, payload ausente/tipo errado, remetente/frame não autorizado; nenhum efeito | Remoção do parse/guard e strings de canal alteradas |
| Sem teto arbitrário | Acervo com 31 e mais pads; ordem e IDs preservados | Limite indevido precisa teste de spec mesmo se nenhum operador o produzir |

Para geração antiga, assertar **efeito real na fronteira**: nenhuma sessão antiga apta a tocar, concessões antigas liberadas conforme contrato, B preservada. Checar só o nome do estado pode deixar áudio tocando indevidamente. A lista de mutações é hipótese a confirmar no relatório; Stryker não garante gerar remoção de qualquer chamada ou reordenação de awaits. Para riscos ausentes da família de operadores, usar uma variante quebrada controlada em scratch para demonstrar a sensibilidade do teste e removê-la depois.

### Estado, clock, áudio e corridas sob controle

**Recomendação:** AudioPort fake sem codec deve oferecer sessão com posição, estado de atividade e emissão controlada de playing/ended/error; `play()` retorna promise resolvida/rejeitada explicitamente pelo teste. LeasePort fake segura respostas e expõe recursos ativos; armazenamento tem failpoints por operação. Não usar sleeps para “esperar a corrida”. Enumerar ordens de concessão, STOP, resolução de play, eventos atrasados, fechamento da janela e rejeição de IPC.

Clock monotônico/IDs injetados deixam logs e deadlines previsíveis. Vitest possui fake timers; eles não simulam mídia, IPC ou o event loop de processos externos. Restaurar timers e listeners no teardown. [Timers oficiais](https://vitest.dev/guide/mocking/timers).

**Recomendação:** manter exemplos determinísticos dos bugs críticos e acrescentar fast-check para sequências de comandos e combinações de falhas. Modelo reduzido guarda somente direitos e observáveis: parado/ocupado, pad autorizado, recurso ativo, revisão e arquivos publicados; não copiar reducer/algoritmo de produção. Propriedades: no máximo uma sessão ativa, edição e playback nunca concedidos simultaneamente, evento antigo não muda sessão nova, reinício abre parado, nenhuma referência publicada aponta para cópia não confirmada. Salvar seed, path de shrinking, sequência mínima e versão. [Model-based testing, incluindo alerta contra modelo espelho](https://fast-check.dev/docs/advanced/model-based-testing/).

O scheduler fast-check controla promessas embrulhadas, não todo o SO, eventos externos ou início dos efeitos de uma promise já executada. Inserir controle nos seams corretos; salvar ordem gerada. [Scheduler e limites](https://fast-check.dev/docs/advanced/race-conditions/). Opcionalmente modelar concessão/STOP/edição em TLA+ com duas tentativas e um editor; declarar bounds e reproduzir contraexemplo em teste real. Isso complementa, não substitui, mutação.

### Domínio, adapters e Electron completo

**Recomendação:** domínio puro: tabelas de transição e invariantes por exemplos e geração. Controlador: promises/eventos controlados. Storage: integração com disco temporário real mais portas de falha; reiniciar processo nos pontos críticos, pois lançar exceção não representa todo crash. Adapter HTMLAudio: contrato comum executado contra fake e implementação real em runtime apropriado, sem presumir que jsdom decodifica áudio. IPC: schema, autoridade e erro em testes de fronteira mais smoke da bridge real.

**Fato:** Playwright classifica automação Electron como experimental. [API Electron](https://playwright.dev/docs/api/class-electron). **Recomendação:** poucos e2e Electron com produção empacotada para importação, reprodução/STOP, clique ocupado, edição, exclusão e recuperação; Windows no desenvolvimento e Mac como gate de release. Uma suíte só com fake não valida codecs/protocolo/output. Um evento `playing` não mede som na saída física. Executar faixas reais e medir início/STOP no Mac/interface alvo; registrar SO, CPU, runtime, formato e saída usada. Continuidade após falha e reroteamento de dispositivo continuam questões empíricas.

Mutação e2e inteira por mutant teria alto custo de build/processo, difícil controle de instrumentação e pouca seleção por teste. O runner command do Stryker permite integração genérica, mas perde otimizações; não é integração Electron pronta. [Runner command](https://stryker-mutator.io/docs/stryker-js/configuration/#testrunner-string). Não condicionar dia zero a resolver esse problema: mutar lógica de coordenação em Node, verificar wiring real com e2e e introduzir mutação de adapters em browser somente após spike.

## 4. Enforcement que governa a escrita

**Recomendação:** ampliar a proposta inicial de `recommendedTypeChecked` para uma seleção explícita a partir de `strictTypeChecked`, revisada regra a regra e pinada. **Fato:** presets strict/all não têm a mesma estabilidade dos demais presets; upgrades podem mudar regras fora de major. [Política oficial](https://typescript-eslint.io/users/configs/). Não usar `all` indiscriminadamente: muitas regras conflitantes ou sem relação com risco tornam exceções habituais.

Matriz proposta para checks mecânicos:

| Área | Permitido e caminho aprovado | Bloqueio e diagnóstico esperado |
|---|---|---|
| Domain | Tipos/transições puros; clock e IDs recebidos | Import Node/DOM/main ou `Date.now()` direto: “domain sem ambiente; receba Clock/ID na fronteira” |
| Contracts | DTO/schema serializável, validador autorizado | Import de implementação: “contrato não conhece serviço; mova coordenação para main/controller” |
| Renderer | Contracts/domain e bridge tipada | Node/Electron/fs: “use library.import por bridge, nunca caminho de disco do renderer” |
| UI React | Intenção enviada ao controlador único | `new Audio`, `.play()` e gestão paralela de sessão fora do adapter: “use PlaybackController; adapter é dono de mídia” |
| Main/library | Caso de uso usando StoragePort e concessão | Escrita fs fora de storage: “use operação gerenciada; preserva staging/recovery” |
| Preload | Bridge finita por operação | Export de ipcRenderer/invoke genérico: “exponha função com DTO validado e canal fixo” |
| Bootstrap | Compor implementações | Instanciar adapter concreto em módulo arbitrário: “conecte na composition root” |

**Fato:** dependency-cruiser expressa regras from/to, ciclos e dependências não resolvidas; ESLint `no-restricted-syntax` aceita seletores AST e mensagens específicas. [Regras do grafo](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md), [restrição sintática](https://eslint.org/docs/latest/rules/no-restricted-syntax). **Recomendação:** um mecanismo de grafo (dependency-cruiser), lint para sintaxe/efeitos, TypeScript para ambientes/tipos, schemas e testes para runtime. Não instalar dois plugins concorrentes para a mesma matriz.

Validar grafo com fixtures proibidas: alias, reexport/barrel, import de tipo, `node:fs` e `fs`, import transitivo, require e import dinâmico. Política inicial proíbe formas dinâmicas no código produtivo que dificultem o grafo, com exceções locais necessárias ao build. Exigir imports resolvidos e incluir novos arquivos automaticamente. Testes de guardrail usam snippets válidos/inválidos e verificam mensagem/regra; são testes da política, não testes espelho do app.

**Ressalva:** AST por nome não prova ausência de efeito. Alias de função, acesso computado, reflexão e módulos autorizados que passam capacidades adiante podem escapar. Não prometer que banir `Audio` impede toda reprodução. Preferir encapsulamento, tsconfigs sem globals indevidos, imports limitados e testes de arquitetura/runtime. Se um risco exige seguir símbolos/tipos, uma regra local tipada precisa ter testes próprios. Impedir violação acidental é viável; agente com permissão para alterar o próprio checker ainda pode enfraquecê-lo.

Regras adicionais recomendadas: `no-explicit-any`, família `no-unsafe-*`, `no-floating-promises` com `ignoreVoid:false`, `no-misused-promises`, `switch-exhaustiveness-check`, sem non-null assertion e sem cast duplo para contornar fronteiras. Não proibir toda mutabilidade: recursos de áudio têm ciclo de vida; concentrar mutação no dono, preservar transições puras e contratos observáveis. Remover código morto, fallback silencioso que inventa sucesso, flags redundantes e abstrações sem responsabilidade explícita pela revisão; nem todo slop é detectável por regra.

**Contratos executáveis recomendados:** schemas no ingresso IPC/manifesto, parse de `unknown`, comandos finitos, IDs e revisão, validação de remetente/frame e testes negativos sem efeitos. Não basta checar shape: autorização e concessão vêm da sessão viva, não de `isPlaying` informado pela UI. Context isolation/sandbox e ausência de API genérica são requisitos de runtime além do lint. [Recomendações de segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security).

**Exceções governadas:** comentário local com regra/operador, motivo, risco e referência da decisão; menor escopo possível; falhar diretivas inúteis e warnings; nenhuma exclusão global para obter verde. Mudanças em configurações, globs, helpers de teste, snapshots e schemas devem evidenciar o efeito no enforcement e passar revisão explícita. Um caminho aprovado deve vir com exemplo pequeno, factory/porta quando necessário e comando que funciona, não só proibições. Quando uma regra reclama, o diagnóstico deve indicar arquivo, import/efeito, camada e alternativa; evitar “architecture violation” sem ação.

## 5. Comandos e artefatos propostos

Contrato de comandos a criar **posteriormente**, com scripts Node portáveis (sem depender de bash no Windows):

```text
npm ci
npm run verify:static
npm run test:unit
npm run test:contracts
npm run test:integration
npm run test:mutation
npm run test:mutation -- --incremental
npm run build
npm run test:electron
```

`verify:static` reuniria format check, lint sem warnings, typecheck por ambiente, grafo e fixtures da política. `test:mutation` invocaria `stryker run`; o conjunto completo deve ignorar/remover reutilização incremental quando configurado para execução integral. O agente deve usar comandos realmente implementados no scaffold, não relatar esta lista como já executável. Rodar pelo lockfile; registrar SHA e dirty diff, versões, plataforma, comandos e exit codes. Escolher fonte de fixtures de mídia redistribuível e registrar hash dos bytes.

Proposta de evidência por execução: diretório imutável com manifest de ambiente, stdout/stderr, relatório Vitest, HTML/JSON Stryker, triagem de survivors/ignorados/timeouts, seeds e traces reduzidos, manifesto e árvore de arquivos após falha de armazenamento; e2e com trace/screenshot/vídeo quando disponíveis e logs correlacionados dos processos. Capturar evidência antes do teardown e confirmar que sobreviveu.

Eventos recomendados: tentativa/generation, requestId, sessão da janela, padId/assetId, revisão, transição anterior/nova, concessão, comando, resultado e motivo do descarte de callback. Clock monotônico para duração; timestamp de parede para correlação. Sem conteúdo de mídia ou caminhos pessoais desnecessários. Logs são diagnóstico, não principal oráculo: provar estado visível, direitos/recursos e disco. Acrescentar métricas de início/STOP só com definição e medição real; não introduzir tracing remoto obrigatório num app offline.

Gate recomendado: checks estáticos + testes relevantes + mutação desde a primeira lógica + revisão do escopo e exceções. PR pequena pode fazer execução integral barata; release exige build e smoke Mac com mídia real. Falha em ferramenta ou corrida flaky não é sucesso inconclusivo disfarçado: preservar artefato, explicar o que faltou e corrigir o harness. Nenhuma meta numérica autoriza remover teste, reduzir glob ou alterar spec sem decisão explícita.

## Conclusão e fontes decisivas

A ideia mais útil do pstack é construir e provar a própria ferramenta de verificação, preservar evidência e manter correspondência entre comportamento, modelo e código. Não depende de instalar o plugin: [create-verification-skill](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/create-verification-skill/SKILL.md) e [formal verification](https://github.com/cursor/plugins/blob/05b49176bc9e00d8e9e3dbf136fa76631cd6468a/pstack/skills/create-formal-verification-skill/SKILL.md) documentam mecanismos concretos e seus limites.

StrykerJS 10.1.1 permite começar mutação com Vitest desde o primeiro incremento; não prova a spec nem substitui e2e/hardware. A divergência entre [documentação do runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/) e [teste Browser Mode no código atual](https://github.com/stryker-mutator/stryker-js/blob/8f24ef0be3a2119fc44ac48bfce58930ab2c9032/packages/vitest-runner/test/integration/browser-mode.it.spec.ts) exige pinagem e spike antes de depender dessa integração. [Incremental](https://stryker-mutator.io/docs/stryker-js/incremental/) acelera feedback; execução integral continua necessária após mudanças transversais.

O esclarecimento sobre lint reforça a necessidade de matriz de dependências, fronteiras de efeitos, contratos executáveis e mensagens com caminhos aprovados. [dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md), [typescript-eslint](https://typescript-eslint.io/users/configs/) e [segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security) oferecem mecanismos complementares. Regras abundantes devem corresponder a riscos e decisões verificáveis; nem presets nem score eliminam julgamento técnico.

Nenhum arquivo do app/config foi implementado e a proposta inicial não foi alterada por esta pesquisa. JSON versus SQLite permanece decisão de persistência separada; o harness de failpoints, contratos e recuperação deve permitir avaliar qualquer opção sem confundir formato com garantia transacional da mídia.
