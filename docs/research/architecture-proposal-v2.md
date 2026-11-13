# Arquitetura proposta — revisão 2

Proposta para discussão, 2026-11-13. Substitui recomendações da primeira proposta onde houver divergência. Só documentação; não houve implementação, benchmark ou validação do runtime empacotado.

Base: [lint e deslop](round-2-lint-deslop.md), [persistência e eventos](round-2-persistence-events.md), [pstack e mutação](round-2-pstack-mutation.md). Fontes primárias, snapshots e limites estão nessas pesquisas.

## Decisões propostas

| Tema | Revisão |
| --- | --- |
| Estrutura | Manter um projeto modular, com camadas e direção de dependências verificadas |
| Persistência | SQLite para metadados desde V1; mídia externa gerenciada |
| Lint | Política ampla desde a primeira lógica; ESLint preferido por regras locais tipadas, não por exclusividade de análise de tipos |
| Arquitetura | dependency-cruiser como dono do grafo; testes negativos das próprias regras |
| Testes | Vitest + Stryker desde o primeiro comportamento, incluindo coordenação e falhas |
| Eventos | Comandos/resultados tipados e transições puras com efeitos explícitos; sem bus global/event sourcing |
| Verificação | Harness reproduzível com isolamento, diagnóstico, execução real e artefatos preservados |
| unknown | Restrito a ingressos, erros de infraestrutura e testes negativos autorizados; não atravessa contratos internos validados |

## Camadas e caminho aprovado

Manter domain, contracts, main, preload e renderer. Domain não conhece ambiente; contracts contém DTOs/schemas e não implementação. Main/preload/renderer não importam implementações uns dos outros. Main e renderer podem usar domain; os três processos podem usar contracts. Dependências externas ficam em allowlists explícitas, incluindo o validador nos contratos. Nova pasta deve entrar numa categoria conhecida ou falhar, não escapar da matriz.

Dentro do main, armazenamento é dono de SQL e filesystem. Dentro do renderer, adapter de áudio é dono do elemento; controlador possui tentativa/transições e React envia intenções/observa snapshots. Composition root conecta implementações, sem contêiner genérico.

Helpers aprovados devem fazer o trabalho correto mais curto: registro de handler que valida remetente, payload e resposta; operação de importação que incorpora staging/publicação; controlador que cuida de geração/cancelamento. Testes e exemplos mínimos documentam como acrescentar um caso de uso. Não criar abstrações vazias preventivamente.

## Persistência: por que mudar

JSON versionado era apenas metadados com schemaVersion/migrations, não áudio ou Git. Para 30 músicas comporta os dados, mas a proposta exigia protocolo próprio de integridade, recuperação, snapshots, exclusões pendentes e backup. SQLite reduz esse trabalho e fornece transações/constraints. Volume não motivou a mudança.

Modelo inicial: AudioAsset, Pad e Repertoire; relações/ordenação persistidas com IDs estáveis. Um repertório na V1 e cópia própria por importação. Schema final deve evitar relação muitos-para-muitos ou entidade extra sem semântica necessária. Nome/cor pertencem ao pad; biblioteca futura precisará decidir o que é compartilhado e o que é específico da entrada do repertório.

Um escritor no main, transações curtas, FKs verificadas e migrations explícitas. Preferência inicial por node:sqlite, condicionada à estabilidade da API na versão pinada e spike empacotado Windows/Mac; pesquisa observou API release candidate no runtime analisado. Não transformar preferência em compatibilidade comprovada. better-sqlite3 é alternativa com custo de addon/rebuild. Operações síncronas longas não podem bloquear resposta do main; medir e separar trabalho se necessário.

Áudio continua externo ao banco. Importar copia para staging, valida e promove arquivo antes de publicar metadados. Excluir registra remoção e tarefa de limpeza em transação, depois apaga cópia e conclui tarefa. Falha deixa pendência recuperável; original nunca é excluído. Commit SQLite não torna durável/atômico o conjunto banco+arquivo. Backup completo precisa de banco e mídia coerentes; não implementar UI de backup sem requisito.

## Eventos sem barramento global

Usar uma função de transição pura:

```text
transition(state, input) -> { state, effects }
```

PlayPad/Stop/BeginEdit são intenções; LeaseGranted/AudioStarted/PlaybackEnded/EffectFailed são resultados correlacionados. Um executor realiza efeitos e devolve resultados. Não disparar disco/áudio dentro de reducer ou depender de listener opcional para concluir operação necessária.

Controlador no renderer é único dono do transporte. Main arbitra acesso exclusivo entre reprodução, edição e recuperação. Estado do banco é a autoridade de metadados confirmados. Não replicar isPlaying como autorização.

Tentativas usam geração e concessão ligadas à sessão da janela. STOP invalida geração antes de await; concessão antiga recebida depois é liberada sem tocar. Evento antigo não altera sessão nova. Novos pads permanecem ignorados até parada/liberação confirmada. Callbacks e IPC não oferecem ordem global; testar ordens explicitamente. Não colocar STOP numa fila atrás de operação longa.

Observers tipados com unsubscribe servem UI/diagnóstico. Bus delimitado só com consumidores independentes reais. Event sourcing, CQRS separado e outbox não atendem requisito atual. HTMLAudioElement continua primeira opção de motor para faixas longas, com apenas um apto a tocar; Web Audio depende de medição de latência.

## Política de lint ampla e governada

ESLint + typescript-eslint strictTypeChecked é a preferência revisada, com React/hooks/a11y e regras de testes. Oxlint/tsgolint já tem análise de tipos e é alternativa séria. A vantagem específica proposta de ESLint é regra customizada com checker para seguir identidade de símbolos; plugins JS Oxlint ainda tinham limitações nesse ponto na pesquisa. Não escrever essas regras se o grafo/encapsulamento já resolverem o problema.

Selecionar convenções úteis do deslop; não portar ou instalar preset inteiro sem avaliar. Um modo Oxlint principal ou residual somente para regras deslop exige provar lacuna útil e atribuir um dono por regra. Sem dois presets generalistas sobrepostos. Biome também tem análise de tipos, mas sua equivalência para os casos críticos e APIs customizadas precisa de teste. Não há benchmark do projeto justificando preferência por velocidade.

Categorias obrigatórias desde início: escapes de tipos, promessas/async, exaustividade, imports/efeitos permitidos, contratos, React/acessibilidade, testes focados/triviais e supressões. Config pinada e revisada regra a regra; upgrades mostram diff das regras. Heurísticas de complexidade são convenções revisáveis, não garantia de correção.

### unknown e Zod

Zod é a escolha proposta para validar dados que cruzam fronteiras runtime. Input bruto de IPC, arquivo, dispositivo ou erro ainda é não confiável; unknown representa isso honestamente. Após parse, usar z.infer/output e resultados discriminados. Regra central: dados não validados não saem do ingresso; unknown não é parâmetro/retorno de contratos internos de negócio.

Allowlist estreita para validadores/registradores de ingresso, normalização de erros e fixtures negativas. catch usa unknown por segurança; não substituí-lo por any. Um callback Electron pode fornecer any: confiná-lo imediatamente como unknown e validar, sem propagar. Esconder a palavra unknown via inferência não significa que a fronteira deixou de existir.

Não exigir parse Zod em toda chamada entre funções internas já tipadas; validar nos ingressos e nas invariantes necessárias. Cada interface interna usa tipos fechados. Proibir unknown globalmente pode incentivar casts/as/any ou abstrações tortas: é contrário ao objetivo da governança. Regras deslop de unknown/typeof precisam de escopo explícito compatível com esse fluxo.

### Enforcement e exceções

Grafo fiscaliza arestas/ciclos/não resolvidos; lint fiscaliza construções e APIs; schemas fiscalizam runtime; testes/mutação fiscalizam comportamento. Diagnóstico deve informar regra, arquivo, destino proibido e alternativa aprovada. Ex.: renderer -> main/storage: use a operação importAudio pela bridge.

Fixtures ilegais e legais verificam checker real, alias, reexport, import type, builtins nus/node:, globals e ausência de pastas no escopo. Proibir require/import dinâmico de produção inicialmente; exceção real é local e revisada. Regras de áudio por texto não bastam: aliases/símbolos precisam de fixtures e resolução adequada.

Sem supressão ampla para obter verde. Exceção local identifica regra, razão, evidência compensatória e condição de revisão. Quem pode editar checker também pode enfraquecê-lo; revisão explícita das guardrails e checks obrigatórios na branch continuam necessários.

## Mutação desde a primeira lógica

Entregar teste e Stryker junto do primeiro reducer/controlador. Começar com suíte completa no núcleo pequeno; incremental local, invalidado após mudanças transversais. Pinagem de core/runner/Vitest/Node e prova de execução nos sistemas alvo. Não presumir que mutação Vitest instrumenta processos Electron separados.

Gate proposto para núcleo crítico: 100% dos mutantes válidos não excluídos detectados, sem survivors/NoCoverage não triados; zero mutantes não passa. Reportar contagens, ignorados, erros e timeouts, não apenas percentual. Equivalência exige justificativa localizada revisada; não baixar score ou estreitar glob para aprovar. A meta é uma política de sensibilidade para um escopo pequeno, não prova da especificação.

Escopo cresce com lógica: transições, concessões, validação, importação/exclusão, recuperação, protocolo. Adapters com comportamento não são excluídos pelo nome. Seeds e variantes defeituosas controladas complementam operadores: nem todo bug de ordenação é gerado automaticamente. Teste deve falhar por observável de produto, não porque viu chamada interna diferente.

Promises e áudio controláveis permitem testar sem sleeps: STOP durante aquisição/início, callbacks antigos, IPC perdido e fim natural. Disco/SQLite real em temporário testa integração e failpoints; morte de processo testa recuperação. fast-check pode gerar sequências com modelo reduzido independente, preservando seed e sequência mínima. Não copiar reducer como oráculo.

## Verificabilidade inspirada no pstack

Aproveitar Launch, Doctor, Drive, Evidence e Cleanup: execução isolada em diretório descartável, checagem do runtime/perfil, condução de uma feature real, captura antes do teardown e encerramento só dos recursos criados. O pstack orienta construir/provar esse harness; não fornece automaticamente enforcement Electron ou mutação.

Mapa de features liga requisito a cenário, comando e artefato. Registrar SHA/dirty diff, versões, plataforma, comandos/exit codes, seed/ordem e relatórios. Logs locais correlacionados por tentativa, sessão, concessão e revisão; sem serviço remoto obrigatório. E2e guarda trace/imagem quando útil; relatório de mutação guarda HTML/JSON. Estado/arquivos e recursos são oráculos; logs ajudam investigação.

Um comando de verificação portátil deve executar estática, fixtures de governança, testes e mutação. Fluxos Electron empacotados e teste físico Mac complementam; não confundir evento playing com som ou CI com ensaio de palco. Harness precisa executar caminho real e sobreviver a cleanup antes de ser chamado pronto.

## Ordem de implementação proposta

1. Camadas mínimas, pipeline estático, fixtures de guardrails e primeiro comportamento com mutação, sem módulos vazios.
2. Spike empacotado de áudio/protocolo e SQLite nos runtimes alvo; conferir codecs, ranges, driver, saída e latência.
3. Fatia importar -> persistir -> tocar -> STOP -> excluir, com integração real e harness isolado.
4. Falhas/recuperação e casos concorrentes, mantendo mutation gate sobre toda lógica crítica acrescentada.
5. Grade/edição final e release Mac ensaiado com repertório/dispositivo reais.

Continuam pendentes formatos reais, latência aceitável, Mac/arquitetura/interface alvo e aceitação de API RC do driver. Nenhuma escolha documental comprova esses gates.
