# Guardrails para agentes no mr-emo-virtual-pad

Pesquisa em 13/11/2026. Escopo: recomendação para implementação futura; nenhuma configuração ou aplicação foi criada. Repositório observado: README curto e assets, sem convenção de documentação ou código a auditar. **Evidência** abaixo identifica fatos nas fontes; **proposta** identifica julgamento para este produto. Links para branches e documentação `latest` são mutáveis; esta nota não é uma auditoria de versões fixadas nem prova de eficácia das práticas.

## Resultado recomendado

**Proposta:** começar com TypeScript estrito, ESLint com informação de tipos, uma verificação pequena do grafo de imports, contratos IPC validados em runtime e testes dos comportamentos de palco e de arquivos. Manter um `AGENTS.md` curto apontando para especificação e arquitetura. CI deve executar os mesmos checks locais, sem correções automáticas. Não criar plataforma de agentes, monorepo, DI container, biblioteca de plugins, banco de dados ou múltiplos repertórios na V1.

Os riscos centrais são áudio sobreposto ou reiniciado por engano, comandos assíncronos concluídos depois de STOP, edição durante reprodução e perda/exclusão indevida de arquivos. Regras de estilo e índices de cobertura não demonstram que esses riscos estão controlados.

## Evidência: práticas reais, sem alegação de consenso

- **OpenAI, harness engineering:** existe um relato primário de uma equipe que organizou conhecimento no repositório, usou `AGENTS.md` como mapa e aplicou restrições arquiteturais por linters e testes estruturais. A equipe relata problemas com um manual monolítico. É experiência interna publicada, não experimento controlado nem evidência de que este pad precise de todas as suas camadas, agentes de manutenção e ferramentas. **Aplicação proposta:** índice curto e checks objetivos, sem reproduzir sua estrutura extensa. [Relato da OpenAI](https://openai.com/index/harness-engineering/).
- **VS Code:** aplicativo Electron/TypeScript com `AGENTS.md` que encaminha às instruções do Copilot; essas instruções descrevem arquitetura e validação. A configuração ESLint contém regras locais e restrições específicas por camada, inclusive exceções explícitas para fixtures. Isso comprova mecanismos concretos, não que todos sejam bloqueantes: há regras com severidade `warn`. **Aplicação proposta:** copiar a separação entre orientação e fiscalização, não a arquitetura de extensões e serviços. [AGENTS.md](https://github.com/microsoft/vscode/blob/main/AGENTS.md), [instruções](https://github.com/microsoft/vscode/blob/main/.github/copilot-instructions.md), [ESLint real](https://github.com/microsoft/vscode/blob/main/eslint.config.js).
- **ElectronIM:** exemplo menor de app Electron com guia de agentes que aponta organização, comandos e infraestrutura de testes; pede cenários válidos/inválidos e verificação de comportamento observável. Seu `package.json` executa lint e bundle em `pretest`. Isso permite verificar parte do guia contra automação real. Não comprova que cada regra textual esteja aplicada em CI ou que o app seja AI-first. **Aplicação proposta:** documentar apenas comandos existentes e usar filesystem real em diretório temporário nos testes de persistência. [AGENTS.md](https://github.com/manusa/electronim/blob/main/AGENTS.md), [scripts reais](https://github.com/manusa/electronim/blob/main/package.json).

Esses repositórios públicos ativos são exemplos de instruções para agentes em projetos Electron, não uma amostra representativa de produtividade ou confiabilidade. Não encontrei nesta investigação fundamento para chamar seu conjunto de regras de consenso. A tentativa de ler um workflow `build.yml` do ElectronIM retornou 404; não deduzo a configuração de CI a partir desse caminho.

## Contrato de produto que deve virar teste

**Requisitos fornecidos:** offline; cerca de 20–30 botões; um arquivo estéreo por botão; uma faixa por vez; clique começa do zero; clique na ativa ignorado; trocar exige STOP; sem pausa; fim retorna a parado; editar só parado; importar copia; excluir remove a cópia interna; uma grade persistida. Biblioteca independente e vários repertórios são futuros.

**Proposta de interpretação:** clicar em qualquer outro pad enquanto há reprodução também é ignorado, sem enfileirar nem trocar automaticamente. Slot vazio não toca. Quantidade exata de slots, formatos aceitos e aceitação/conversão de mono ou multicanal precisam ser definidos antes do importador: “20–30” não deve virar um limite arbitrário no schema. Para cumprir estéreo estritamente, validar canais ao importar; extensão ou MIME sozinhos não comprovam conteúdo decodificável nem dois canais.

**Proposta de estado:** um controlador único possui `stopped`, `starting(padId, token)`, `playing(padId, token)` e `stopping(token)`; estes dois estados transitórios são internos, não recursos novos da interface. Todo estado diferente de `stopped` bloqueia edição e novos PLAY. STOP invalida o token antes de aguardar trabalho assíncrono; a liberação para novo PLAY ocorre após interromper o áudio. Sucesso, erro e `ended` só afetam a sessão correspondente. Ao terminar/errar, liberar recursos e retornar a parado com erro visível quando houver. Não persistir sessão de reprodução; reabrir sempre parado.

Testes devem demonstrar pelo menos:

| Cenário | Resultado observável esperado |
| --- | --- |
| PLAY A parado | inicia A em zero; há no máximo uma fonte ativa |
| PLAY A ou B durante A, inclusive `starting` | nenhuma nova fonte, nenhum seek, nenhuma fila |
| STOP repetido | idempotente; interrompe fonte e invalida início pendente |
| PLAY A → STOP → início tardio de A | A não volta a tocar |
| A termina; depois PLAY B; chega evento antigo de A | B continua; evento antigo não altera sessão |
| fim natural ou falha de decode/play | parado; nova tentativa possível; falha não fica silenciosa |
| editar/importar/excluir/reordenar durante estados ocupados | comando recusado pelo controlador, não só botão desabilitado |
| edição assíncrona em andamento → PLAY | operações serializadas; não reproduzir arquivo sendo substituído/excluído |
| STOP → PLAY A | começa de zero, sem retomar posição anterior |

Não confiar apenas em booleanos separados (`isPlaying`, `isEditing`), em handlers da UI ou em um teste que verifica se `pause()` foi chamado. Mesmo uma implementação interna que use `pause()` para STOP não deve expor pausa/retomada como comportamento do produto.

## Fronteiras propostas, pequenas e verificáveis

**Proposta:** quatro diretórios de produção: `src/domain` para transições puras e contratos; `src/renderer` para UI, controlador e adaptador de áudio; `src/preload` para bridge estreita; `src/main` para janela, IPC e armazenamento. Não criar um pacote para cada um. Funções pequenas com dependências passadas explicitamente bastam para testar relógio/áudio e armazenamento.

| Origem | Dependências locais permitidas |
| --- | --- |
| domain | domain |
| renderer | renderer, domain |
| preload | preload, domain |
| main | main, domain |

A comunicação entre processos usa IPC em runtime, nunca import direto da implementação. Contratos de dados compartilhados não importam Electron, DOM nem filesystem. APIs de áudio ficam no adaptador do renderer; filesystem somente no armazenamento do main. O controlador serializa PLAY e mutações; o main também serializa mutações de disco. Um main que aceita mensagens arbitrárias não fica seguro apenas porque a UI está desabilitada.

**Evidência:** `no-restricted-imports` restringe imports estáticos por nome/padrão; não é análise completa de dependências nem restrição geral de `require`/imports dinâmicos. **Proposta:** usá-lo para APIs externas proibidas; usar resolução de grafo para as fronteiras locais, evitando padrões frágeis que deixam passar caminhos relativos e aliases. [ESLint](https://eslint.org/docs/latest/rules/no-restricted-imports).

**Evidência:** dependency-cruiser permite regras `from`/`to`, resolução e detecção de ciclos; eslint-plugin-boundaries oferece fiscalização de dependências entre elementos. **Proposta:** escolher somente dependency-cruiser na V1 para matriz acima, ciclos e imports não resolvidos. Configurar resolução conforme os tsconfigs e incluir dependências de tipo na matriz; não excluir `node_modules` antes de verificar imports de built-ins. Impedir imports externos no domain, exceto eventual validador de schema explicitamente escolhido. Criar fixtures de violação por alias, caminho relativo e reexport para verificar o checker. Não adicionar boundaries em paralelo; ele é alternativa se a equipe preferir diagnóstico integrado ao ESLint. Ambos dependem da configuração e não descobrem relações criadas por strings em runtime. [Referência dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md), [boundaries](https://github.com/javierbrea/eslint-plugin-boundaries).

## Conjunto enxuto de regras exatas proposto

Esta é uma especificação de checks futuros, não um arquivo de configuração já funcional. Fixar versões compatíveis no lockfile ao implementar. Base: `@eslint/js` recommended e `typescript-eslint` `recommendedTypeChecked`, com `parserOptions.projectService: true` nos arquivos TS pertencentes ao projeto. Não habilitar `all` nem todo preset estrito por princípio. O preset é base adicional; a tabela explicita regras críticas e opções que não devem depender de defaults.

**Evidência:** typed linting usa APIs do TypeScript, permite análises mais profundas e custa análise do projeto; `projectService` e `recommendedTypeChecked` são documentados oficialmente. Não substitui `tsc`. [typescript-eslint](https://typescript-eslint.io/getting-started/typed-linting/).

| Check proposto (erro salvo indicação) | O que pega neste app | O que não pega |
| --- | --- | --- |
| `tsc --noEmit`, `strict: true` em main/preload/renderer/domain | null indevido, tipos incompatíveis, `any` implícito | JSON/IPC falsificado, casts, áudio funcionando |
| `noUncheckedIndexedAccess: true` | slot/ID consultado sem tratar ausência | índice errado que ainda existe |
| `exactOptionalPropertyTypes: true` | confusão entre omitir campo e atribuir `undefined` | semântica de exclusão e migrações |
| `@typescript-eslint/no-explicit-any: error`; `no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-call`, `no-unsafe-member-access`, `no-unsafe-return`: `error` | atalhos que desligam verificação, propagação de `any` | `as Pad` pode mentir; entrada precisa parser |
| `@typescript-eslint/no-floating-promises: ['error', {ignoreVoid: false}]` | import/save/play iniciados sem tratamento | `.catch(() => {})` passa mesmo engolindo falha |
| `@typescript-eslint/no-misused-promises: ['error', {checksVoidReturn: true}]` | callback async passado a API que ignora retorno | callback sync com efeitos incorretos |
| `@typescript-eslint/switch-exhaustiveness-check: ['error', {considerDefaultExhaustiveForUnions: false}]` | novo evento/estado union sem case | transição errada dentro de case; `if` não coberto |
| `@typescript-eslint/no-require-imports: error` no código de produção; `no-restricted-imports` para `electron`, todos built-ins Node (formas nuas e `node:`) no renderer/domain | uso direto de privilégios fora do processo correto | import dinâmico/computado, globals e dependência transitiva |
| grafo: matriz anterior, sem ciclos e sem dependências locais não resolvidas | vazamento de camada por imports resolvidos e reexports | segurança do IPC, efeitos e carga dinâmica |
| factory única de janela + teste de opções efetivas e bridge | regressão em isolamento e API exposta | exploração não prevista; revisão ainda necessária |

Para manter a fronteira verificável: produção somente ESM estático, sem `require` nem `import()` computado; restringir `ImportExpression` via `no-restricted-syntax` em `src/**` na V1 e globals Node do renderer via `no-restricted-globals` (`process`, `Buffer`, `require`). Exceções de build/teste ficam fora desse escopo. Preload só importa `contextBridge`/`ipcRenderer` do Electron e contratos; proibir outros membros via restrição de import e revisão da bridge. Não usar essa política como defesa contra dependência maliciosa: o isolamento runtime continua necessário.

Fontes e limites: [`strict`](https://www.typescriptlang.org/tsconfig/strict.html), [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html), [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html), [`no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises/), [`switch-exhaustiveness-check`](https://typescript-eslint.io/rules/switch-exhaustiveness-check/). Mudanças de versão podem alterar diagnósticos; atualizar ferramentas em mudanças revisáveis.

## IPC e disco: invariantes de runtime

**Evidência:** Electron recomenda isolamento de contexto, sandbox, validação do remetente IPC, limitação de navegação/janelas e não exposição de APIs brutas. Context isolation separa contextos, mas a bridge ainda precisa ser restrita. [Segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation).

**Proposta específica:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`; sem conteúdo remoto, sem webview, sem novas janelas; CSP sem execução inline/eval no pacote. Protocolo local controlado entrega apenas assets do app e mídia autorizada por ID. Validar remetente como janela/frame principal esperado e origem local explícita, não prefixo de URL. Não aceitar origem `null` genericamente. O protocolo não recebe um caminho livre a ser concatenado.

Bridge com métodos nomeados: `loadGrid()`, `importPad(slotId)` (main abre o seletor), `updatePad(slotId, camposPermitidos)`, `deletePad(slotId)`; nenhum `invoke(channel, args)` genérico, `readFile(path)`, `unlink(path)` ou evento Electron exposto. Validar parâmetros e manifest como `unknown`, usando schema ou parser pequeno, antes de I/O; rejeitar IDs inválidos, campos inesperados e paths. Validar também respostas na entrada do renderer para falhar com diagnóstico. Tipagem compartilhada não valida mensagens em runtime. Quando houver coordenação de edição/reprodução via IPC, testar autorização por sessão e ordenação, não confiar em `isPlaying` enviado pelo chamador.

**Proposta de persistência:** `grid.json` versionado e `media/<id-gerado>.<ext-validada>` sob diretório próprio em `app.getPath('userData')`; salvar somente referências internas relativas. Electron documenta `userData` como área de configuração do app; guardar mídia grande ali é escolha nossa e requer informar o uso de espaço e verificar disponibilidade. [API app](https://www.electronjs.org/docs/latest/api/app#appgetpathname).

Importar para temporário, validar/decode, concluir cópia e só então publicar manifest; não apontar para arquivo original. Exclusão: remover referência e salvar manifest antes de apagar mídia; falha ao apagar produz aviso/limpeza pendente, não referência quebrada silenciosa. Restringir exclusão a IDs gerados, caminhos resolvidos dentro da raiz e arquivos regulares, recusando symlinks; nunca apagar o original. Testar disco cheio/permissão, arquivo ausente, nomes Unicode/espaços, dois arquivos de mesmo nome e manifest corrompido. Troca de manifest por temporário/rename reduz gravação parcial, mas não promete durabilidade contra toda perda de energia; testar recuperação e preservar cópia anterior válida. Não introduzir transação distribuída: aceitar órfão recuperável é melhor que perder áudio referenciado.

Para evolução, cada slot pode referenciar um `mediaId` independente do rótulo e da posição; na V1 cada importação cria sua própria cópia, mesmo para conteúdo repetido. Assim excluir pad exclui sua cópia sem refcount. A futura biblioteca compartilhada exigirá mudar explicitamente essa política; não implementar deduplicação ou garbage collector agora.

## Testes e CI proporcionais

**Proposta:** testes unitários da tabela de transições com adaptador de áudio controlável; integração de storage/IPC com diretórios temporários reais e entradas inválidas; poucos testes Electron de ponta a ponta para importar → tocar → ignorar troca → STOP → tocar outro → fim → reabrir grade → excluir. Fixtures curtas estéreo, sem usar músicas privadas. Um teste que só chama mock de `play` não demonstra exclusividade física nem reprodução audível.

**Evidência:** Electron documenta automação com WebDriver e Playwright, sem manter uma solução própria; sua existência não valida codecs nem a saída de áudio do hardware. [Testes Electron](https://www.electronjs.org/docs/latest/tutorial/automated-testing).

**Proposta de CI futura:** instalar pelo lockfile; rodar format check, lint com `--max-warnings 0`, typecheck, grafo e testes. Executar integração/Electron e empacotamento em Windows e macOS, pois desenvolvimento Windows não valida produção Mac. Se custo impedir matriz completa em todo PR, checks rápidos por PR e matriz antes de release; registrar a lacuna, sem chamar build Windows de validação Mac. Checks obrigatórios na proteção da branch dão efeito bloqueante; hooks locais são conveniência e podem ser contornados. Não afirmar que há proteção/CI hoje.

Antes de liberar para palco, testar pacote Mac offline com dispositivo real, canais L/R distintos, STOP, cliques rápidos, reinício, arquivos longos e falha de saída. Definir latência aceitável com o músico e medir; não inventar SLA. Escolha entre streaming por elemento de áudio e buffers Web Audio fica pendente de duração/latência: streaming tende a usar menos memória; buffers permitem controle preciso, mas PCM pré-decodificado de todas as faixas pode custar muito. Não pré-carregar 30 faixas inteiras por regra. Automação de CI não garante ausência de dropout sob carga/suspensão/dispositivo real.

Sem mínimo global de cobertura, limite arbitrário de linhas ou teto universal de complexidade ciclomática. Publicar cobertura para localizar ramos não exercitados; exigir evidência para todos os cenários de reprodução, segurança e persistência listados. Duplicação de estado e mistura de efeitos com transições justificam refatorar; uma função curta pode conter uma corrida grave. Testes devem sobreviver a reorganização interna. Não criar testes de snapshots extensos da grade ou getters triviais para subir percentual.

## Exceções e suppressions

**Proposta:** correção é padrão; supressão local exige regra identificada, motivo técnico, escopo mínimo e teste ou evidência compensatória. Dívida temporária inclui condição de remoção e issue; exceção permanente documenta por que é segura. Nenhum `eslint-disable` de arquivo inteiro nem desligamento global de regra para fazer tarefa passar. Revisar separadamente alterações em checks, schemas e listas de exceções.

Executar ESLint com `reportUnusedDisableDirectives: 'error'` e `reportUnusedInlineConfigs: 'error'`; essas opções detectam diretivas inúteis, não a veracidade da justificativa. Motivo obrigatório pode começar como revisão humana; não alegar que ESLint core o impõe. [`Configure Rules`](https://eslint.org/docs/latest/use/configure/rules).

Propor `@typescript-eslint/ban-ts-comment` com `ts-ignore: true`, `ts-nocheck: true`, `ts-check: false`, `ts-expect-error: 'allow-with-description'`. `@ts-expect-error` é aceitável em teste negativo com descrição; em produção exige revisão específica. A opção exige descrição, não prova sua qualidade. Preferir `unknown` e validação a `as`; cast em fronteira não substitui parser. Fixtures inválidas podem ser construídas como `unknown`, sem relaxar o projeto inteiro. [Regra oficial](https://typescript-eslint.io/rules/ban-ts-comment/).

`void promessa` não é tratamento de falha; por isso `ignoreVoid: false`. `.catch` deve produzir erro de domínio/feedback ou registrar condição esperada com justificativa. Esse conteúdo precisa de teste e revisão. Não criar um logger corporativo só para satisfazer uma regra.

## ESLint versus Biome neste cenário

| Opção | Evidência atual | Decisão proposta |
| --- | --- | --- |
| ESLint + typescript-eslint | Typed lint usa o checker TypeScript; ecossistema extensível e regras configuráveis; análise custa tempo e configuração de projetos. [Docs](https://typescript-eslint.io/getting-started/typed-linting/) | Preferir na V1: estado assíncrono e fronteiras importam mais que micro-otimizar lint neste repo pequeno. Usar formatter separado simples, sem duplicar regras de estilo. |
| Biome | Integra lint/format e tem mecanismo próprio de inferência. `noFloatingPromises` já existe, mas está no grupo experimental `nursery` e ativa scanner/types domain. Não é correto afirmar que Biome não faz análise de tipos. [Linter](https://biomejs.dev/linter/), [regra atual](https://biomejs.dev/linter/rules/no-floating-promises/) | Alternativa válida se simplicidade operacional pesar mais; confirmar equivalência nos casos críticos e manter `tsc`/grafo/testes. Não presumir paridade com typescript-eslint pelo nome da regra. |

Não há benchmark neste app nem razão observada para migrar por velocidade. Evitar dois linters fiscalizando o mesmo código. Reavaliar com caso concreto que a ferramenta escolhida não detecte.

## O que fica em documentos versus o que bloqueia mudança

**Documentos propostos, não criados nesta pesquisa:** `AGENTS.md` aponta comandos reais e fontes; `docs/spec.md` registra tabela de comportamento e decisões ainda abertas; `docs/architecture.md` registra fronteiras, dono do estado, protocolo IPC e persistência. Registrar decisão curta quando houver escolha controversa, sem obrigar um ADR para cada alteração. Instruções centrais: preservar V1; não adicionar troca automática/pausa/repertórios; atualizar spec e testes quando comportamento autorizado mudar; não enfraquecer checks para obter verde; relatar comandos executados e limitações.

**Invariantes executáveis futuros:** compilador/lint para erros locais; grafo para dependências; parser para dados externos; guardas e serialização para comandos; testes para transições, isolamento e disco; CI obrigatório para executar tudo. Docs explicam intenção e trade-offs; não impedem import indevido, IPC perigoso ou troca durante áudio. Checks demonstram propriedades limitadas, não qualidade total. A primeira implementação deve entregar esse conjunto pequeno junto aos caminhos reais, sem construir infraestrutura especulativa.
