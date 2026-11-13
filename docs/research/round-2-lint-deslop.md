# Rodada 2 — lint, deslop e arquitetura verificável

Pesquisa em 2026-11-13. Documento de decisão, sem implementar o aplicativo ou configurações. Contexto: `architecture-proposal.md`, Electron offline, desenvolvimento Windows e produção Mac; V1 com um repertório de aproximadamente 20–30 músicas, sem teto artificial. O esclarecimento do usuário é requisito central: regras devem governar o caminho de implementação, impedir violações de camadas e tornar o caminho aprovado fácil. Contar regras não é a medida de sucesso.

**Conclusão recomendada:** substituir a justificativa genérica “ESLint é necessário para tipos” por uma escolha explícita entre motores. Recomendo inicialmente **ESLint + typescript-eslint strictTypeChecked, regras React e regras locais de arquitetura/efeitos; dependency-cruiser como único dono do grafo; formatter separado; testes e mutação desde o primeiro comportamento**. A razão é a capacidade de escrever também regras customizadas com o checker TypeScript e a menor dependência de APIs alpha, não exclusividade de análise de tipos. **Oxlint com tsgolint é alternativa tecnicamente séria**, especialmente se adotar deslop for prioridade. Não instalar três linters generalistas sobre o mesmo código.

## Método, versões e limites

Li a proposta; consultei documentação oficial via web; clonei o deslop em diretório temporário e li README, `src/index.ts`, regras, auxiliares, configurações, scripts e lockfile. Não executei o plugin nem benchmarks; inspeção estática não comprova ausência de bugs. Não há medição de custo neste projeto. Não consultei um repositório pstack identificado: a inspiração aqui significa evidência executável, sem atribuir práticas específicas a um projeto não fornecido.

Versões observadas no endpoint `latest` do registro npm nesta consulta, não uma matriz de integração validada:

| Pacote | Versão | Evidência e consequência |
| --- | --- | --- |
| ESLint | 10.14.0 | [registro](https://registry.npmjs.org/eslint/latest): Node `^20.19.0 || ^22.13.0 || >=24` |
| typescript-eslint | 8.72.2 | [registro](https://registry.npmjs.org/typescript-eslint/latest): peers ESLint 8.57/9/10 e TS `>=4.8.4 <6.1.0` |
| Oxlint | 1.93.0 | [registro](https://registry.npmjs.org/oxlint/latest): Node `^20.19.0 || >=22.12.0`; peer tsgolint `>=7.0.2005` |
| oxlint-tsgolint | 7.0.2007 | [registro](https://registry.npmjs.org/oxlint-tsgolint/latest) |
| Biome | 2.6.7 | [registro](https://registry.npmjs.org/@biomejs/biome/latest) |
| ai-deslop | 0.5.2 | [registro](https://registry.npmjs.org/ai-deslop/latest), igual ao package.json inspecionado |

Recomendação: fixar versões e lockfile, validar Windows/macOS e manter atualização deliberada. Não copiar o TS 7.0.2 usado pelo deslop para uma instalação typescript-eslint cujo peer observado exclui essa versão. O Node de ferramentas não é automaticamente o Node embarcado pelo Electron.

## O que o deslop realmente entrega

Snapshot: commit [`edaab1bf10b9c6951f9728c4a6360d7091056602`](https://github.com/maharshi365/deslop/tree/edaab1bf10b9c6951f9728c4a6360d7091056602), datado de 2026-11-05 no checkout. Nome publicado: **ai-deslop**. É um **plugin Oxlint de regras AST determinísticas**, com regras vendorizadas de anti-slop e regras próprias; não um serviço de revisão com LLM, gerador de testes ou detector confiável da autoria humana/IA. Fontes: [README](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/README.md), [implementação/exportações](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/src/index.ts).

O preset exportado habilita `options.typeAware: true`, regras `deslop/*` e regras padrão. A implementação inclui `typescript/await-thenable`, `typescript/switch-exhaustiveness-check` e `oxc/no-accumulating-spread`, ausentes da tabela de regras padrão do README lido; inclui ainda seletor contra `new Map()` vazio sem argumentos de tipo. Portanto o README sozinho não é inventário suficiente. O preset **não** configura toda a família `no-unsafe-*`, toda política React ou a arquitetura do aplicativo. [Fonte exata: index.ts](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/src/index.ts).

Famílias observadas:

- Segurança/evidência: assertions encadeadas, alargamento para unknown/object/dicionários, assertions com justificativa, parâmetros object/unknown, retornos unknown e narrowing por typeof.
- Convenções: filter seguido de map, spread condicional vazio, nomes com shape, aliases pass-through, Reflect.get/apply.
- Testes: module mocking, testes de substring constante, repetição de expect e testes cujas assertions só verificam chamadas.
- Opt-in: duplicação de constantes/tipos, aliases de schemas, imports renomeados, reexports fora de entrypoints, máximo de termos booleanos e canonicalização Tailwind.

Essas famílias estão no [catálogo e código](https://github.com/maharshi365/deslop/tree/edaab1bf10b9c6951f9728c4a6360d7091056602/src). A análise de aliases própria é lexical; nomes contendo “type” não significam acesso ao checker completo: [resolução local](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/src/vendor/anti-slop/shared/type-alias-resolution.ts). As regras padrão type-aware vêm do motor Oxlint/tsgolint.

**Limites importantes verificados no código:**

1. `require-safety-comment-for-type-assertion` aceita marcador textual `SAFETY:` seguido de conteúdo e dispensa `as const`; não demonstra que a justificativa seja verdadeira. [Implementação](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/src/vendor/anti-slop/rules/require-safety-comment-for-type-assertion.ts).
2. `no-call-only-assertions` reconhece padrões de chamadas it/test/expect e poucos matchers; permite `toHaveBeenCalledWith`. Não mede qualidade geral, não exige teste em todo comportamento e não substitui mutação. [Implementação](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/src/rules/no-call-only-assertions.ts).
3. `max-boolean-conditions` conta termos de condições de controle; grupos parentizados contam como um termo e condições movidas para variáveis escapam desse contador. É heurística de apresentação, não limite semântico de complexidade. Config verificada: `"deslop/max-boolean-conditions": ["error", { "maxConditions": 3 }]`. [Documentação](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/docs/max-boolean-conditions.md).
4. Proibir `unknown` indiscriminadamente conflita com a fronteira IPC/JSON; proibir typeof pode atrapalhar validação legítima de infraestrutura. `filter().map()` com 30 pads não é evidência de defeito. São decisões locais, não verdades sobre slop.

O [package.json](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/package.json) fixa Oxlint e `@oxlint/plugins` em 1.82.0, usa TS 7.0.2 e Vitest ^5.0.1. `check` faz build, `oxlint src` e typecheck; `test` é separado. A [.oxlintrc.json](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/.oxlintrc.json) só adiciona explicitamente `oxc/no-accumulating-spread`: não é demonstração de autoaplicação do preset deslop. Não há dependência direta oxlint-tsgolint no manifesto lido; o consumidor precisa providenciar o motor para as regras typed.

[bench.mjs](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/bench.mjs) exercita a regra Tailwind, inclusive com callbacks sintéticos sem custo de parser; [bench-project.mjs](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/bench-project.mjs) compara plugin instalado/local em projeto externo, contando diagnósticos e tempo. Isso não prova equivalência de diagnósticos individuais, velocidade de todas as regras ou superioridade para Electron. Tailwind traz dependências mesmo sendo recurso dispensável aqui; avaliar custo instalado, não só velocidade Rust.

**Política sugerida se adotado:** selecionar regras nominalmente. Priorizar assertions encadeadas, alargamento artificial e testes triviais; permitir unknown nas fronteiras aprovadas. Não habilitar cegamente o recommended para depois acumular disables.

## Comparação dos motores

| Critério | ESLint + typescript-eslint | Oxlint | Biome |
| --- | --- | --- | --- |
| Async/tipos | Checker TS e regras typed maduras | tsgolint/typescript-go; não apenas sintaxe | Inferência própria e scanner de projeto; não substitui tsc |
| Cobertura necessária | no-floating-promises, no-misused-promises, await-thenable, família no-unsafe, switch-exhaustiveness-check | Equivalentes no namespace typescript; confirmar opções na versão fixada | noFloatingPromises e useExhaustiveSwitchCases existem, ainda nursery nas páginas consultadas |
| Imports | Restrições por sintaxe, plugins e extensibilidade | Plugins import e regras nativas; grafo próprio disponível | Regras de imports e scanner; conferir resolução/inferência para o caso concreto |
| React | Plugin oficial hooks, inclusive diagnósticos do Compiler | Regras portadas e JS plugins para lacunas | Regras React/hooks/a11y próprias; não presumir paridade integral |
| Customização | AST, seletores, scope e regras com checker TS | Regras Rust; plugins JS com API ESLint v9+ em alpha; plugins JS typed não suportados | GritQL e, na documentação atual, plugins JS próprios; não apenas GritQL |
| Custo relevante | Programa TS, parser, plugins Node; medir antes de otimizar | Binários Rust + Go para tipos; JS plugins adicionam custo e compatibilidade | Ferramenta integrada; scanner/inferência aumentam trabalho além de formatação |

Fontes para a comparação: [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/), [regras](https://typescript-eslint.io/rules/), [custom rules com checker](https://typescript-eslint.io/developers/custom-rules/); [Oxlint catálogo](https://oxc.rs/docs/guide/usage/linter/rules.html), [typed](https://oxc.rs/docs/guide/usage/linter/type-aware), [JS plugins e limitações](https://oxc.rs/docs/guide/usage/linter/js-plugins); [Biome linter](https://biomejs.dev/linter/), [plugins](https://biomejs.dev/linter/plugins/), [floating promises](https://biomejs.dev/linter/rules/no-floating-promises/javascript/), [exhaustiveness](https://biomejs.dev/linter/rules/use-exhaustive-switch-cases/javascript/); [React plugin oficial](https://react.dev/reference/eslint-plugin-react-hooks).

A documentação Oxlint declara 59 de 61 regras typed de typescript-eslint suportadas na consulta. Isso invalida descartar Oxlint por ausência de tipos, mas não estabelece equivalência irrestrita de configurações. Plugins JS não têm acesso à análise typed, apesar de o motor nativo tsgolint ter. Em Biome, GritQL não acessa o modelo semântico, enquanto a API JS atual oferece mais informações; não portar regras ESLint presumindo a mesma API. Essas distinções importam para regras de efeitos baseadas na identidade real de símbolos.

Biome merece consideração como ferramenta integrada; não o escolheria como único enforcement typed neste projeto sem provar os casos críticos: suas duas regras citadas são nursery, e `noFloatingPromises` documenta aceitar `void` como descarte. Não assumir suporte ao `ignoreVoid: false` de typescript-eslint. Inferência parcial não é prova de paridade com o checker TS.

## Política ampla desde o primeiro código

**Recomendação:** tudo que é política adotada roda em CI como erro; heurísticas também podem bloquear, mas ficam identificadas como convenções revisáveis. Não usar `all` sem triagem: presets mudam e podem impor regras contraditórias. `strictTypeChecked` é mais alinhado que o `recommendedTypeChecked` anterior, mas não é estável segundo semver como os presets recomendados; revisar diff de regras em upgrades. [Shared configs](https://typescript-eslint.io/users/configs/).

### Defeitos e escapes de tipos

Base recomendada: `js.configs.recommended`, `tseslint.configs.strictTypeChecked`, `languageOptions.parserOptions.projectService: true` para arquivos incluídos em tsconfigs apropriados. Não liberar todos os arquivos por um default project amplo. [Configuração typed](https://typescript-eslint.io/getting-started/typed-linting/).

Fragmento de política ESLint com nomes/opções documentados; **não é configuração completa nem arquivo aplicado**:

```js
{
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-floating-promises': ['error', {
    ignoreVoid: false, checkThenables: true,
  }],
  '@typescript-eslint/no-misused-promises': ['error', {
    checksConditionals: true, checksVoidReturn: true, checksSpreads: true,
  }],
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': ['error', {
    considerDefaultExhaustiveForUnions: false,
    allowDefaultCaseForExhaustiveSwitch: true,
  }],
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/ban-ts-comment': ['error', {
    'ts-ignore': true, 'ts-nocheck': true,
    'ts-expect-error': 'allow-with-description',
    minimumDescriptionLength: 12,
  }],
}
```

Fontes: [floating](https://typescript-eslint.io/rules/no-floating-promises/), [misused](https://typescript-eslint.io/rules/no-misused-promises/), [switch](https://typescript-eslint.io/rules/switch-exhaustiveness-check/), [comentários TS](https://typescript-eslint.io/rules/ban-ts-comment/), [catálogo](https://typescript-eslint.io/rules/). Se base core e extensão TS fiscalizarem a mesma coisa, desligar a core, como fazem presets oficiais. `ignoreVoid: false` exige tratar rejeição mesmo com `void`; handler `.catch(() => {})` ainda pode passar. Lint não comprova recuperação correta do erro.

### React, testes, segurança e convenções

- Renderer: preset recomendado do plugin oficial React hooks, com hooks/dependências, pureza, refs, imutabilidade e setState indevido; a11y, chaves de listas e proibição de HTML perigoso. Verificar cada regra na versão do plugin escolhida, não presumir que só existem duas regras hooks. [React](https://react.dev/reference/eslint-plugin-react-hooks).
- Testes: bloquear `.only`, promessas de assertions não aguardadas e testes sem assertions pelo plugin do runner escolhido; avaliar fixtures antes de ligar cada regra. Deslop detecta alguns testes de baixo sinal, não todos. Mutação e assertions observáveis continuam necessárias.
- Segurança/efeitos: proibir eval/Function, rede em código de produto offline e APIs ambientais fora de adapters. Bloquear fetch no produto é política deste app, não regra universal de correção; áudio e IPC legítimos usam seus adapters.
- Complexidade: exemplo verificado `complexity: ['error', { max: 10, variant: 'modified' }]`. Variante modified evita contar cada case como ramificação separada em máquina de estados. O limiar 10 é proposta revisável, não evidência científica. Não adicionar simultaneamente três contadores semelhantes nem fragmentar transições só para passar o número. [ESLint complexity](https://eslint.org/docs/latest/rules/complexity).
- Convenções: imports de tipos consistentes, sem require/import dinâmico inicialmente, sem console fora de logger aprovado, sem assertions de produção fora de adapters autorizados. Preferir restrições específicas a tamanho arbitrário de arquivo. Banir todos os aliases ou nomes com shape não protege arquitetura.

## Arquitetura como caminho executável

**Proposta de propriedade única:** dependency-cruiser cuida de arestas resolvidas, matriz de camadas, ciclos e dependências não resolvidas. Linter cuida de sintaxe, uso de APIs/símbolos e caminhos aprovados. Compiler cuida de tipos; schemas validam dados em runtime; testes cobrem comportamento. Não repetir a matriz em plugin boundaries, no-restricted-imports e dependency-cruiser. [Recursos de regras de grafo](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).

Matriz proposta: domain só domain; contracts só contracts e pacote validador autorizado; main/preload/renderer podem usar contracts; main e renderer podem usar domain; nenhuma implementação cruza entre main/preload/renderer. Dentro de main, serviço de biblioteca usa porta de armazenamento; fs só no adapter de armazenamento. Bootstrap compõe. Decidir explicitamente exceções para mídia/protocolo e bootstrap, que naturalmente precisam de APIs Electron. Não transformar “camadas” em proibição de toda dependência externa.

Fragmento dependency-cruiser com campos documentados, para ilustrar uma regra e não toda a matriz:

```js
{
  name: 'domain-nao-depende-de-outras-camadas',
  severity: 'error',
  comment: 'Mova o efeito para um adapter e passe dados ao domínio.',
  from: { path: '^src/domain/' },
  to: { path: '^src/(contracts|main|preload|renderer)/' },
}
```

Não basta esse fragmento: a configuração completa deve fechar pacotes externos, builtins e arquivos fora de src; testar aliases, reexports e imports exclusivamente de tipos. Adotar allowlist onde possível para que uma nova pasta não escape por omissão. Imports de tipos também representam acoplamento arquitetural, salvo exceção deliberada.

| Violação proposta | Mecanismo e caminho aprovado | Diagnóstico que o autor deve receber |
| --- | --- | --- |
| Componente importa storage do main | Grafo resolvido | `ARCH001: renderer → main proibido; use window.padApi.importAudio()` |
| Serviço de biblioteca importa fs | Grafo, restringindo builtins ao adapter | `ARCH002: use ManagedAudioStore; fs só em main/storage` |
| Componente cria Audio ou chama play | Regra local com resolução de símbolos; construção só no adapter DOM | `EFFECT001: use PlaybackController.requestPlay(padId); elemento pertence ao adapter` |
| Preload expõe invoke genérico | Regra local e teste da superfície real | `IPC001: exponha método nomeado de PadApi; canal arbitrário não é contrato` |
| Handler aceita payload com cast | Regra local exigindo registrador aprovado + schema | `CONTRACT001: registre com registerValidatedHandler(schema, handler)` |
| Importação publica referência antes da cópia | Teste de integração e mutação | `IMPORT001: falha na cópia deve manter manifesto anterior` |

IDs, nomes dos helpers e mensagens acima são **design proposto**, não plugins existentes. Os helpers aprovados devem encapsular validação, tratamento de erro e registro; proibir o acesso à primitiva fora deles torna seu uso mais simples que repetir infraestrutura. `registerValidatedHandler` deve validar remetente/origem e entrada, não apenas verificar a presença de `.parse` em algum lugar. Não criar código vazio agora.

Exemplo de sintaxe verificada para política inicial global de imports estáticos:

```js
'no-restricted-syntax': ['error', {
  selector: 'ImportExpression',
  message: 'ARCH003: use import estático para manter o grafo verificável; exceção exige decisão registrada.',
}],
'@typescript-eslint/no-require-imports': 'error',
```

[Seletores e mensagens](https://eslint.org/docs/latest/rules/no-restricted-syntax). `no-restricted-imports` permite proibir módulos por texto, mas sozinho não resolve todas as variantes de alias; nesta proposta, a matriz fica no grafo. [Regra](https://eslint.org/docs/latest/rules/no-restricted-imports).

**Ressalvas mecânicas:** seletor por nome `Audio` pode acusar símbolo local ou perder alias/window.Audio. Proibir `.play()` textual acusa métodos não relacionados e perde referências indiretas. Para efeitos críticos, regra customizada deve resolver binding/símbolo, cobrir aliases e ter fixtures de bypass; ESLint permite acesso ao checker via typescript-eslint. Oxlint pode aplicar restrições sintáticas/scope em JS, mas não portar automaticamente uma regra custom typed para sua API JS atual. Nenhum linter é sistema completo de efeitos: uma função aparentemente pura pode esconder I/O numa dependência. Allowlist de imports e módulos pequenos reduzem essa superfície.

Contratos TS não validam IPC em runtime. O Electron recomenda métodos específicos no bridge em vez de expor primitivas IPC genéricas; testar o bridge executado, isolamento e opções da janela. [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation). A tipagem global do renderer deve expor apenas a API finita; tsconfigs não devem injetar tipos Node em todo o app. Preload precisa dos tipos apropriados à API permitida, não de uma declaração de que pode usar todo Node em sandbox.

## Verificabilidade, mutação e exceções

Recomendação desde dia zero: fixtures de conformidade das guardrails com exemplos permitidos e proibidos; executar o comando real e conferir diagnóstico/exit code. Casos: alias para fs, reexport indireto, import de tipo atravessando camada, require/import dinâmico, chamada Audio com alias e configuração que acidentalmente deixa renderer fora do lint. Testar a guardrail verifica o enforcement; não é teste espelho da implementação do produto.

Para produto, começar com transições e controlador: clique enquanto toca ignorado, STOP invalida tentativa pendente, tocar sempre do zero, edição só parado. Em disco temporário, importação copia e exclusão só apaga cópia gerenciada. Mutação começa nesses primeiros testes, não depois de um percentual de cobertura. StrykerJS suporta TS e documenta integração com Vitest: [introdução](https://stryker-mutator.io/docs/stryker-js/introduction/), [Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/). Compatibilidade exata de versões ainda deve ser validada; não inferi suporte a toda versão Vitest pelo nome do runner.

Política proposta: mutar domínio/controlador e coordenação de importação/exclusão desde sua criação; PR só passa com sobreviventes críticos explicados ou mortos. Não exigir 100% cego nem permitir baseline que eternize sobreviventes sem dono. Complementar mutantes automáticos com falhas semeadas específicas, como remover a checagem de geração: nem todo mutador gera a regressão de concorrência que importa. Rodar sem hardware via portas, mantendo smoke empacotado no Mac para comportamento real.

Exceção governada: arquivo/símbolo exato, regra, motivo, evidência, responsável e condição de remoção. Nunca exclusão de diretório inteiro para fazer passar. Razão textual não é prova; revisão avalia conteúdo. Habilitar detecção de diretivas inúteis (ESLint `linterOptions.reportUnusedDisableDirectives: 'error'`) e bloquear `eslint-disable` amplo; razões de supressão podem exigir regra local/plugin adicional. Mudanças em guardrails, lockfile ou escopo dos checks exigem revisão explícita. Branch protection torna checks obrigatórios; lint local sozinho não impede enfraquecer o próprio lint.

## Combinações e decisão final

1. **Preferida para este contexto:** ESLint + typescript-eslint estrito + plugins React/testes e regras locais; dependency-cruiser; Prettier (ou outro formatter único); tsc e mutação. Evita a dependência alpha para regras críticas custom typed. É ampla desde o começo, não o preset mínimo da proposta anterior.
2. **Alternativa Oxlint como principal:** Oxlint + oxlint-tsgolint, políticas nativas de tipos e React/imports, seleção de deslop e regras locais JS. `options.typeAware: true`, `jsPlugins: ['ai-deslop']` e nomes `deslop/*` são sintaxe verificada. Para floating promises, conferir explicitamente `ignoreVoid: false` e `checkThenables: true` na [regra Oxlint](https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-floating-promises.html). Necessário validar plugins na versão fixada; ai-deslop foi inspecionado com @oxlint/plugins 1.82.0, não com toda versão futura. Boa escolha se regras locais necessárias funcionarem sem checker custom.
3. **Híbrida quando houver lacuna concreta:** Oxlint é dono de core/typed/regras nativas/deslop; ESLint fica **somente** com regras ausentes ou custom typed. Sem preset recommended/strict paralelo no ESLint residual. Usar `eslint-plugin-oxlint` para desligar sobreposições e auditar configuração efetiva por arquivo; comparar também equivalências semânticas com nomes diferentes. Se optar pelo inverso, Oxlint roda apenas deslop selecionado, desligando categorias/regras padrão e sem espalhar seu recommended. A presença de dois executáveis só se justifica por capacidade efetivamente usada.
4. **Biome:** alternativa integrada atraente para formatação e lint, condicionada à validação da cobertura typed e das regras customizadas. Se usado só como formatter, linter e organize-imports/assists ficam desativados; não disputar imports com outra ferramenta. Não o adicionar como terceiro linter para “mais segurança”.

Zero duplicação significa **um dono por política de lint**, não remover verificações complementares: tipo, validação runtime, teste e mutação respondem perguntas diferentes. Entre linters, cada regra equivalente tem uma única execução e configuração. Grafo fica no dependency-cruiser em todas as alternativas. Ordenação/formatação fica no formatter. Segurança Electron continua em configuração runtime e testes.

**Síntese:** a recomendação anterior era insuficientemente fundamentada e estreita para o desejo de governança. ESLint não monopoliza tipos; Oxlint/tsgolint cobre quase todo o conjunto typed e já recebe plugins JS, com ressalva alpha e sem checker em plugins JS. Biome também evoluiu em inferência e extensibilidade. Deslop é enforcement determinístico de convenções úteis e discutíveis, não garantia de qualidade, arquitetura ou testes. A prioridade deve ser matriz fechada de dependências, efeitos confinados, contratos validados e diagnósticos que apontem a API aprovada; regras amplas e mutação entram desde o primeiro comportamento.

Fontes decisivas: [código deslop fixado no commit](https://github.com/maharshi365/deslop/blob/edaab1bf10b9c6951f9728c4a6360d7091056602/src/index.ts), [Oxlint typed](https://oxc.rs/docs/guide/usage/linter/type-aware), [limites JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins), [typescript-eslint custom typed](https://typescript-eslint.io/developers/custom-rules/), [Biome plugins](https://biomejs.dev/linter/plugins/), [Biome async nursery](https://biomejs.dev/linter/rules/no-floating-promises/javascript/), [dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) e [StrykerJS](https://stryker-mutator.io/docs/stryker-js/introduction/). Escolha final deve preservar os mesmos requisitos verificáveis independentemente do motor.
