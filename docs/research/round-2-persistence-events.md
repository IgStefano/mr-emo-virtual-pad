# Rodada 2 — persistência, transições e enforcement

Data: 2026-11-13. Pesquisa e recomendação; não implementa app/configuração nem modifica a proposta inicial. Contexto: `architecture-proposal.md` e esclarecimentos do usuário. Não houve delegação.

## Conclusão da revisão

**Recomendo SQLite desde a V1 para metadados, mantendo áudio em arquivos gerenciados externos.** O motivo não é escala: 20–30 músicas cabem tranquilamente em JSON. É o custo total de implementar corretamente integridade, publicação, exclusões pendentes, migrations, recuperação e backup. A proposta JSON já assumia boa parte desse custo. SQLite resolve uma parte maior com mecanismos existentes e testáveis; não resolve a transação entre banco e áudio externo.

**Recomendo transições puras com efeitos explícitos e coordenação direta, sem bus global.** Comandos solicitam ações; eventos registram resultados observados. Uma máquina controla a tentativa de reprodução; o main arbitra exclusivamente reprodução versus edição. IPC é fronteira de processos, não motivo para event sourcing ou CQRS.

**Requisito central:** governar como se escreve código, tornando o caminho aprovado fácil e violações de camadas difíceis. Muitas regras são aceitáveis desde o início quando impõem invariantes úteis; quantidade não é métrica. Checks devem ensinar a correção, ter testes negativos e exceções delimitadas. Mutação deve existir desde o primeiro núcleo executável, especialmente nas regras de exclusividade e geração.

## 1. O que significava “JSON versionado”

Na proposta, JSON é o armazenamento local de **metadados**: IDs, nomes, cores, referência ao arquivo interno e ordem dos pads/repertórios. Os bytes WAV/MP3/etc. ficam fora dele. “Versionado” significa `schemaVersion: 1`, depois migrations explícitas como 1 → 2 quando muda o formato. Não significa versionar músicas no Git, nem manter automaticamente histórico de edições. `revision`, se usado, identifica uma edição do conteúdo; não substitui a versão de schema. Esta é a interpretação da proposta local, não uma exigência do Electron.

Exemplo conceitual: mudar de `pads` com caminhos embutidos para `assets` + `pads.assetId` exige converter dados já salvos; o TypeScript novo não converte o arquivo antigo. SQLite também precisa dessas migrations. O `PRAGMA user_version` é um inteiro administrado pela aplicação, não um migrador automático. [SQLite PRAGMA](https://sqlite.org/pragma.html#pragma_user_version).

Não se deve salvar estado transitório de reprodução como estado a retomar automaticamente. Em ambos os formatos, uma sessão nova começa parada; referências inválidas ou versão futura não viram biblioteca vazia silenciosamente. **Recomendação de produto e segurança operacional.**

## 2. JSON versus SQLite: custo completo

| Responsabilidade | JSON com garantias da proposta | SQLite recomendado |
| --- | --- | --- |
| Formato e inspeção | Legível sem ferramenta; snapshot simples | Inspeção com ferramenta SQL; export JSON opcional |
| Integridade | Schema e validação de IDs/referências/listas em código | `STRICT`, `NOT NULL`, `UNIQUE`, `CHECK`, FKs; domínio e validação de entrada continuam |
| Alteração de vários metadados | Construir e validar snapshot inteiro, substituir e lidar com recovery | Uma transação publica asset/pad/ordem/revisão conjuntamente |
| Recuperação | Definir candidatos válidos, temporários, revisão, backup e política de escolha | Journal/transação recuperam banco; app ainda trata corrupção, migrations e arquivos externos |
| Evolução | Migradores de documentos e publicação segura do resultado | Migradores SQL/dados, versão e commit juntos |
| Exclusão e importação | Protocolo app + escrita segura do manifesto | Mesmo protocolo de arquivos, pendências persistidas em transação |
| Backup útil | Snapshot consistente + cópias de áudio compatíveis | Backup consistente do banco + conjunto correspondente de áudios |
| Distribuição | Sem driver | Driver embutido ou binding; verificar runtime e pacote |

**Fatos que sustentam a comparação:** SQLite oferece commit atômico condicionado às hipóteses do SO/disco; não é garantia contra qualquer corrupção física. FKs precisam estar habilitadas por conexão e verificadas; não presumir defaults do driver. Tabelas `STRICT` reforçam tipos, mas não exprimem todas as regras de negócio. [Commit](https://sqlite.org/atomiccommit.html), [FKs](https://sqlite.org/foreignkeys.html), [STRICT](https://sqlite.org/stricttables.html).

**Código real examinado:** `write-file-atomic/lib/index.js` mantém fila `activeFiles` por caminho dentro do processo, grava temporário, faz `fsync` do arquivo por padrão e `rename`. Não contém um protocolo de backup/schema/referências nem transação com áudio. Na versão consultada não há sincronização explícita do diretório após rename. Isso não invalida a biblioteca; mostra a distância entre substituir um arquivo e entregar recovery completo. [Código](https://github.com/npm/write-file-atomic/blob/main/lib/index.js). Não inferir lock entre processos a partir dessa fila.

**Recomendação:** um escritor no main, uma conexão, transações curtas; começar com rollback journal e política de sincronização conservadora, verificando pragmas efetivos. WAL só mediante necessidade medida de concorrência. WAL acrescenta checkpoint e arquivos auxiliares; copiar apenas `.db` em uso pode perder estado presente no WAL. [SQLite WAL](https://sqlite.org/wal.html). Backup por API própria gera snapshot consistente do banco; não inclui áudio. [Backup API](https://sqlite.org/backup.html).

Modelo sugerido: `assets`, `pads`, `repertoires`, `repertoire_entries`, `pending_file_deletions` e versão de schema. IDs estáveis; entrada associa pad a repertório e posição, com unicidade por repertório. Reordenar deve ser transacional e evitar colisões intermediárias de posição. Na V1 um repertório padrão e uma cópia própria por importação; sem deduplicação. Não adicionar limite rígido de 30. Futuramente distinguir remover entrada, remover pad e excluir asset compartilhado. Estas são recomendações, não schema final.

Migrations: sequência explícita, testar todos os formatos liberados → atual, backup antes de alterações destrutivas, atualizar versão na mesma transação quando a operação permitir. Falha mantém versão anterior ou bloqueia abertura com diagnóstico; schema futuro exige app compatível. Evitar downgrade automático. Não criar abstração que precise esconder SQL e implementar simultaneamente dois backends: uma porta orientada aos casos de uso basta.

## 3. Driver: verificar o Node do Electron, não o Node do Windows

**Verificação em 13/11/2026:** a lista oficial indica Electron estável **45.3.2**, com **Node 24.22.2**. Outros ramos estáveis aparecem na mesma página; não confundir prerelease com última estável. [Electron Releases](https://releases.electronjs.org/?channel=stable).

A documentação versionada no código do **Node v24.22.2** marca `node:sqlite` como **Stability 1.2 — Release candidate**, promovido nesse ramo em v24.15.0. Portanto, dizer hoje que ainda é apenas experimental nesse runtime seria impreciso; dizer que é API estável também. A versão consultada expõe `DatabaseSync` e `backup`; operações da classe são síncronas. [Documento do tag exato](https://github.com/nodejs/node/blob/v24.22.2/doc/api/sqlite.md). A página HTML dessa versão falhou no fetch; a checagem foi feita diretamente pelo arquivo raw do mesmo tag. Não extrapole nomes/classes da documentação Node 26 para o Node 24 embutido.

**Escolha recomendada:** `node:sqlite`, atrás do adapter de persistência, com Electron fixado e API RC aceita explicitamente. Evita distribuir um addon adicional; ainda depende da compilação e integração feita pelo Electron. Não executei o binário Electron empacotado: compatibilidade está documentada pelo runtime, mas funcionamento no pacote final continua sendo gate, não resultado deste relatório.

**Alternativa:** `better-sqlite3` oferece API síncrona e transações, porém traz addon nativo e sua matriz de artefatos/build. A documentação de Electron alerta para ABI própria e rebuild; Forge integra `@electron/rebuild`. Não assumir que um `.node` construído no Windows serve para macOS ou outra arquitetura. [API better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md), [módulos nativos Electron](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules). Usar essa alternativa se o gate do builtin falhar ou se a equipe rejeitar RC, após provar a distribuição nos alvos.

**WASM:** a implementação oficial tem persistência via VFS/OPFS com restrições próprias de workers, isolamento e concorrência conforme VFS. Não é substituição transparente de um banco no `userData` do main. [SQLite WASM persistence](https://sqlite.org/wasm/doc/trunk/persistence.md). Não recomendo na V1: adiciona uma fronteira de persistência sem benefício demonstrado neste desktop offline.

### Gates de decisão verificáveis

- No Electron **empacotado** Windows e Mac de destino, registrar `process.versions`, importar `node:sqlite`, consultar `sqlite_version()`, criar/reabrir banco e testar transação, FK, rollback, migração e backup/restore. Não basta teste passando no Node de desenvolvimento.
- Medir duração das transações e bloqueio do main; não copiar áudio em operação síncrona longa. Se houver impacto perceptível em STOP/IPC, mover persistência para worker com um dono e protocolo explícito, preservando arbitragem imediata no main.
- Testar importação/remoção com reinício forçado entre etapas, falta de espaço e arquivo bloqueado no Windows; validar restauração no Mac real. Processo morto não simula perfeitamente corte de energia.
- JSON só se houver razão demonstrada para rejeitar ambos os drivers e aceitação do custo de recovery. Exigir a mesma matriz de falhas, validação de referências, migrations, snapshot/backup, política de temporários e escritor único. “São só 30 músicas” não satisfaz esse gate.

## 4. Banco e arquivos: protocolo recuperável, não atomicidade conjunta

**Recomendação para ambos os storages:** mídia em diretório local gerenciado, nomes derivados de IDs internos; jamais aceitar caminho arbitrário do renderer como autorização de exclusão. Não apagar o original importado.

Importação sob concessão de edição: copiar original para staging no mesmo volume, validar conclusão e formato, promover para nome interno final, depois publicar metadados. No SQLite, inserir asset/pad/entrada em uma transação. Só notificar sucesso após commit. Crash anterior à publicação pode deixar arquivo sem referência; reconciliar/quarentenar órfãos, sem removê-los cegamente enquanto houver operação viva ou backup dependente. Se a garantia incluir queda de energia, especificar também sincronização de arquivos/diretórios por plataforma: commit do SQLite não força durabilidade do áudio copiado.

Exclusão na V1: transação remove referência visível e registra tarefa de limpeza com ID/caminho interno; depois tenta unlink e confirma remoção da tarefa. `ENOENT` pode contar como já limpo; permissão/arquivo em uso mantém pendência e diagnóstico. Crash após unlink e antes da confirmação deve permitir repetição. Não retornar “arquivo apagado” enquanto apenas a remoção lógica terminou. Em biblioteca futura, validar ausência de outras referências antes de agendar exclusão física.

No início, recuperar banco, concluir/relatar pendências e reconciliar referências com arquivos. Arquivo faltante torna asset indisponível e impede play com erro específico; não apagar silenciosamente seus metadados. Nunca liberar edição durante recovery que modifica mídia.

Backup completo: bloquear edição/limpeza, obter snapshot do banco e copiar todos os arquivos por ele referenciados, validar pacote, depois liberar bloqueio. Backup antigo deve possuir sua própria mídia; não pode depender de arquivo que uma exclusão futura removerá. Restore ocorre com reprodução parada, valida schema/arquivos e só publica conjunto completo. **Limite factual:** atomicidade SQLite cobre seus dados, não esse protocolo externo. [SQLite atomic commit](https://sqlite.org/atomiccommit.html).

## 5. Eventos: vocabulário e limites

**Comando** é intenção que pode ser rejeitada: `PlayPad`, `Stop`, `BeginEdit`, `ImportAudio`, `DeletePad`. **Evento** é resultado observado: `LeaseGranted`, `AudioStarted`, `PlaybackEnded`, `ImportCommitted`, `EffectFailed`. Não publicar `ImportCommitted` quando a cópia só começou. Resultados internos não precisam ser todos broadcast.

**Reducer/máquina:** `transition(state, input) → {state, effects}`. Sem relógio, disco, Electron, DOM, promises ou IDs aleatórios dentro da transição. **Efeito:** descrição como adquirir concessão, iniciar/parar elemento, confirmar liberação; adapter executa e retorna input correlacionado. IDs e tempos entram como dados. A orientação é compatível com reducers sem efeitos descritos pelo Redux, mas não exige adotar Redux. [Redux Style Guide](https://redux.js.org/style-guide/).

**Subscriptions tipadas:** `subscribe(listener: (snapshot: PlaybackSnapshot) => void): Unsubscribe` para observação local; contratos discriminados quando houver múltiplos eventos. Assinante não decide exclusividade e não executa etapa necessária ao commit. Remover listeners no encerramento; tratar erro de observador separadamente do comando, sem desfazer operação já confirmada.

**Código real:** `Event<T>` do VS Code retorna `IDisposable`; `Emitter` contém tratamento de erro e fila de entrega/reentrância. Isso evidencia responsabilidades concretas de subscriptions, não necessidade de copiar seu framework. [event.ts](https://github.com/microsoft/vscode/blob/main/src/vs/base/common/event.ts). Em vez de bus global, dependências explícitas conectam controlador, executor e observadores no composition root.

**Event bus** distribui mensagens a listeners; não fornece automaticamente armazenamento, entrega durável, ordem global ou rollback. **Event sourcing** faz do log histórico a fonte de verdade, reconstruindo estado; **CQRS** separa modelos de leitura/escrita e pode compartilhar banco. Um comando IPC e uma notificação não exigem nenhum desses padrões. Ambos trazem custos que esta V1 não justifica. [Event sourcing](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing), [CQRS](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs). Eventos DOM são sinais do adapter de áudio, não prova de necessidade de arquitetura EDA.

## 6. Autoridade, ordem e cancelamento

Recomendo manter a divisão da proposta com autoridade explicitada:

1. **Main:** único árbitro do acesso ao acervo (`idle | playbackLease | editing | recovery`). Checar e reservar antes do primeiro await. Toda edição, inclusive diálogo de importação e limpeza física, passa por esse gate; concessão identifica sessão/janela e tentativa.
2. **Controlador de playback no renderer:** único dono de estado da tentativa e do adapter de áudio. React emite comandos e observa snapshot; não cria seu próprio `isPlaying` nem chama `play()`.
3. **Banco:** autoridade dos metadados confirmados. Uma transação não é permissão para editar durante playback; exclusividade é regra do coordenador.

Contrato de produto: parado aceita pad e inicia do zero; durante aquisição/início/reprodução/STOP, novos cliques em pad são ignorados, sem fila nem troca automática. Só STOP concluído ou fim natural permite nova faixa. Edição só após parada e liberação confirmadas. STOP é idempotente e invalida geração imediatamente; não pode esperar atrás de operação longa de importação em fila genérica.

Cada tentativa/efeito carrega geração e ID de concessão. STOP invalida geração **antes** de await, para/descarta elemento e solicita liberação. Se aquisição antiga concluir depois, liberar a concessão antiga sem tocar; nunca liberar a concessão de outra tentativa. Callback atrasado de erro/fim não altera estado novo. `AbortSignal` onde suportado ajuda, mas não cancela promessa arbitrária nem desfaz commit. `HTMLMediaElement.play()` é assíncrono e pode rejeitar; seu resultado exige tratamento mesmo após STOP. [HTML media](https://html.spec.whatwg.org/multipage/media.html#dom-media-play).

A fila de transições é local e síncrona; conclusões assíncronas voltam por inputs correlacionados. Não assumir ordem entre IPC, callback DOM e tarefas de disco. Em falha de IPC de liberação, áudio pode estar parado mas acesso permanece indeterminado: não anunciar edição liberada; reconciliar concessão com main. Crash de renderer invalida sessão; nova janela inicia parada. Testar também destruição durante aquisição pendente.

IPC: métodos finitos como `acquirePlayback`, `releasePlayback`, `importAudio`, `deletePad`, `getCatalog`; request/reply com `invoke/handle`, notificação de snapshot apenas após commit. Respostas de erro serializáveis e discriminadas, com código/operação; não depender de preservar classe/stack de Error remotamente. Validação runtime de DTO e remetente no main; preload não expõe `ipcRenderer` genérico nem objeto Electron recebido. [IPC Electron](https://www.electronjs.org/docs/latest/tutorial/ipc), [segurança](https://www.electronjs.org/docs/latest/tutorial/security).

Futuro: adicionar observadores de telemetria/UI por módulo e consultas de biblioteca sem mudar fonte de verdade. Considerar bus delimitado quando houver múltiplos consumidores independentes reais. Eventos duráveis/outbox só se aparecer entrega externa obrigatória; event sourcing só com necessidade concreta de histórico/reconstrução que pague migrations de eventos. Nenhum deles é pré-requisito para repertórios.

## 7. Enforcement que governa o jeito de escrever

As recomendações abaixo refinam a proposta sem implementar configurações. Não avaliar ESLint como mera prevenção de texto ruim: ele governa construções locais; o grafo governa dependências; testes governam comportamento. Fonte de inspiração “pstack” mencionada pelo usuário não foi identificada por URL/versão; não atribuo a ela mecanismos específicos não verificados.

| Regra desejada | Mecanismo e caminho aprovado | Diagnóstico esperado |
| --- | --- | --- |
| Domain não conhece infraestrutura | Grafo com destinos permitidos; tsconfig sem Node/DOM; dependências externas negadas salvo autorização específica | `domain/playback.ts → node:fs proibido; retorne efeito e implemente no adapter main/storage` |
| Renderer não acessa banco/disco/main | Grafo resolve aliases e reexports; restrição de builtin/Electron; Node desligado na janela | `renderer/edit.ts → main/storage proibido; use bridge importAudio do contracts` |
| Só adapter possui áudio DOM | Regra AST para construções/acessos relevantes e diretórios permitidos; portas explícitas | `new Audio fora de renderer/playback/adapter; envie PlayPad ao controlador` |
| Só storage executa SQL/FS | Restringir imports e acesso ambiental fora dos adapters; composition root apenas conecta | `node:sqlite fora de main/storage; use operação de catálogo autorizada` |
| Contratos não importam implementação | Grafo inclui imports de tipo; schema runtime numa entrada aprovada | `contracts → main proibido; declare DTO serializável no contrato` |
| Promessas e transições tratadas | Typed lint, exaustividade e retorno discriminado; proibir escapes globais | `play() sem tratamento; encaminhe sucesso/falha com generation` |

`dependency-cruiser` oferece regras de origem/destino e restrições de dependências; usar como mecanismo principal de grafo, incluindo ciclos e não resolvidos. Testar caminhos absolutos, aliases, barrel e `import type`; bloquear `require` e imports dinâmicos de produção inicialmente, com exceções concretas. [Referência](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).

ESLint `no-restricted-imports` permite mensagens específicas, mas não substitui análise do grafo resolvido. Typed lint `no-floating-promises` ajuda a impor tratamento; `ignoreVoid: false` evita que apenas escrever `void` silencie a regra. Isso não prova que um `.catch()` toma a decisão correta. [ESLint](https://eslint.org/docs/latest/rules/no-restricted-imports), [typescript-eslint](https://typescript-eslint.io/rules/no-floating-promises/).

Criar regras AST próprias apenas para lacunas reais, com fixtures válidas/inválidas: por exemplo impedir `window.Audio`, alias conhecido e acesso direto ao bridge fora do adapter de IPC. Nenhuma regra local genérica prova pureza total de JavaScript; restringir dependências, APIs e composição reduz superfície. Proibir relógio/aleatoriedade/globais mutáveis no núcleo; testes verificam determinismo e ausência de mutação de entrada. Tipos não validam payload IPC em execução nem substituem CSP/sandbox.

Caminho fácil: exemplo mínimo aprovado por caso de uso, porta pequena, executor com resultado tipado, factory de teste e um comando local que execute os mesmos checks do CI. Evitar `shared` genérico e interfaces CRUD universais que deixam contornar o caso de uso. O diagnóstico deve informar aresta/arquivo, regra violada, destino aprovado e exemplo. Um lint que só diz “arquitetura inválida” não cumpre esse requisito.

Exceção governada: regra identificada, arquivo/aresta mínimos, justificativa técnica, teste compensatório e condição de remoção. Sem desabilitar pasta inteira para acomodar um caso. Revisar alterações nas próprias guardrails; check algum impede sozinho que quem altera o repo enfraqueça o check. Supressões inúteis devem falhar. Quantidade de regras deve acompanhar riscos cobertos, não contagem por prestígio.

### Verificabilidade e mutação desde o dia zero

Recomendo fixtures de arquitetura deliberadamente ilegais que o check precise rejeitar, e válidas que precise aceitar; isso testa o enforcement, não apenas a conformidade do código atual. O pipeline deve falhar também se a configuração deixar de analisar uma pasta ou se um alias escapar da resolução.

Desde o primeiro reducer/coordenador, executar mutação com escopo explícito em transições, gates, validação e recovery. StrykerJS oferece seleção `mutate`, thresholds e integração por runners; versões/plugins precisam ser fixados e validados quando houver scaffold. [Configuração oficial](https://stryker-mutator.io/docs/stryker-js/configuration/). Não confundir “mutação desde dia zero” com introduzir estado mutável no domínio.

Casos que devem matar alterações semânticas: remover guarda playing/edição; aceitar callback de geração antiga; liberar lease antes de parar; publicar importação antes de cópia completa; apagar mídia antes de registrar limpeza; ignorar falha de commit; aceitar schema futuro. Nem todo defeito aparece nos operadores automáticos: complementar com injeção de falhas e cenários controlados. Mutante sobrevivente exige análise de lacuna ou equivalência; não baixar threshold só para verde, nem prometer 100% como prova de correção.

Testes de integração usam SQLite real e disco temporário; doubles apenas nas portas de mídia/IPC para controlar ordem. Sequências geradas podem verificar invariantes: nunca dois elementos ativos, nenhuma edição sob lease e nenhum metadado publicado apontando para importação incompleta. Testes empacotados Windows/Mac e recuperação após morte de processo cobrem fronteiras que o reducer não vê. Este documento define gates futuros; não afirma que passaram.

## 8. Síntese e fontes decisivas

A proposta em camadas continua apropriada. A revisão recomendada é trocar o manifesto de produção por **SQLite desde V1**, preferindo `node:sqlite` com aceitação explícita de RC e spike empacotado; JSON continua útil como exportação/fixture, sem segundo backend obrigatório. A informação decisiva de runtime veio de [Electron Releases](https://releases.electronjs.org/?channel=stable) e do [código documental Node 24.22.2](https://github.com/nodejs/node/blob/v24.22.2/doc/api/sqlite.md).

[SQLite commit](https://sqlite.org/atomiccommit.html), [FKs](https://sqlite.org/foreignkeys.html) e [backup](https://sqlite.org/backup.html) sustentam a redução de protocolo próprio, enquanto o [código write-file-atomic](https://github.com/npm/write-file-atomic/blob/main/lib/index.js) mostra o alcance menor da troca segura de um arquivo. Nenhum deles entrega atomicidade banco+áudio.

[Redux](https://redux.js.org/style-guide/), [IPC Electron](https://www.electronjs.org/docs/latest/tutorial/ipc) e o [Event<T> real do VS Code](https://github.com/microsoft/vscode/blob/main/src/vs/base/common/event.ts) sustentam separar transições, efeitos, transporte e subscriptions. A recomendação local é manter coordenação explícita sem bus global e sem histórico como fonte de verdade.

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md), [ESLint](https://eslint.org/docs/latest/rules/no-restricted-imports) e [Stryker](https://stryker-mutator.io/docs/stryker-js/configuration/) dão mecanismos para governar dependências, escrita e força dos testes. A decisão final deve exigir evidência executável, mensagens de correção e exceções revisáveis. URLs em `main/master/latest` são móveis; versões e trechos devem ser fixados ao transformar esta pesquisa em implementação.
