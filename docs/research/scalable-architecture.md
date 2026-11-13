# Arquitetura escalável para o pad virtual offline

Pesquisa: 13/11/2026. Escopo: decisão de arquitetura, sem implementação ou configuração. Repositório consultado: README e assets, sem convenção documental encontrada. Fontes primárias consultadas na web; links de documentação `latest` e código `main` são móveis. Ao implementar, registrar as versões efetivamente usadas de Electron, Node embutido e dependências.

## Síntese e critérios

**Recomendação própria:** um único projeto e pacote, organizado por features e fronteiras de processo; domínio em funções puras; adapters concretos para Electron, disco e áudio. Começar com um documento JSON versionado, um escritor no main e cópias de áudio externas ao documento. Não há necessidade atual de microserviços, monorepo, contêiner de injeção, ORM ou barramento genérico de eventos.

V1 assumida: 20–30 botões; um arquivo estéreo por botão; iniciar sempre do zero; no máximo uma faixa; trocar exige STOP; clicar na ativa é ignorado; sem pausa, loop ou avanço automático; fim natural retorna a parado; editar apenas parado; importar copia; excluir remove a cópia interna; uma grade persistida. Biblioteca independente e múltiplos repertórios são evolução prevista, não telas da V1. Desenvolvimento Windows não substitui validação no Mac de produção.

“Escalável” aqui significa conseguir acrescentar biblioteca/repertórios e localizar alterações sem reescrever a reprodução, não escalar servidores. “AI-first” é uma recomendação de legibilidade para manutenção por humanos e agentes, não uma justificativa para adicionar IA em runtime.

## Evidências e implicações

- **Evidência:** Electron separa main, renderer e preload; IPC atravessa essas fronteiras. **Aplicação proposta:** main possui disco e comandos persistentes, renderer possui UI e adapter de reprodução, preload apenas a ponte tipada. Não criar outro processo para cada feature. [Process model](https://www.electronjs.org/docs/latest/tutorial/process-model), [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc).
- **Evidência:** a orientação oficial é expor métodos específicos via contextBridge, em vez de dar acesso irrestrito a IPC. **Aplicação proposta:** comandos por intenção e validação em runtime no main, mesmo com TypeScript. Renderer isolado, sem Node, conteúdo local e sem navegação remota. [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [Security](https://www.electronjs.org/docs/latest/tutorial/security).
- **Evidência:** Web Audio oferece fontes de buffer em memória, início único por source e evento de término. **Aplicação proposta:** um source novo por disparo; token por execução para ignorar conclusões antigas. Isso não demonstra latência adequada em palco ou suporte aos arquivos reais: é necessária medição. [Especificação Web Audio](https://www.w3.org/TR/webaudio-1.0/).
- **Evidência:** Node documenta flush/fsync e alerta contra gravações concorrentes no mesmo arquivo. **Aplicação proposta:** fila única de mutações e substituição por temporário; `writeFile` isolado não é protocolo de commit. Conferir disponibilidade no Node embutido no Electron escolhido, não no Node instalado no Windows. [Node fs](https://nodejs.org/api/fs.html).
- **Evidência:** SQLite implementa commit atômico com hipóteses sobre armazenamento e sincronização. **Implicação:** reduz trabalho transacional dos metadados, mas não torna um arquivo de áudio externo parte da transação. [Atomic commit](https://www.sqlite.org/atomiccommit.html).

As estruturas e decisões abaixo são **recomendações próprias para este escopo**, não arquitetura prescrita pelas fontes.

## Modelo: catálogo separado do repertório, sem interface extra

Persistir um agregado documental com `schemaVersion`, `revision`, `assets`, `repertoires` e `activeRepertoireId`:

```text
AudioAsset { id, storedName, originalName, byteLength, channels, durationSeconds }
Repertoire { id, name, pads: Pad[] }
Pad { id, position, label, color?, assetId? }
```

`storedName` é um nome interno gerado, relativo à pasta gerenciada; nunca o caminho original. `assetId` identifica o áudio independentemente de nome, botão ou posição. A duração/canais precisam ser obtidos de validação real, não da extensão. Metadados técnicos desconhecidos não devem ser inventados.

A V1 cria exatamente um repertório padrão e só mostra sua grade. `assets` é o catálogo interno, não uma nova tela. Um botão vazio tem `assetId` ausente. IDs sobrevivem a renomear/reordenar e não dependem do índice na grade. A unicidade das posições e a integridade das referências são validadas ao carregar e antes de salvar. O limite exato de slots entre 20 e 30 ainda é decisão de produto; não precisa determinar a arquitetura.

Na V1, cada importação cria uma cópia própria e um asset, sem deduplicação por hash. Assim excluir o áudio de um botão remove seu vínculo e, após commit, sua cópia. Isso evita que dois botões compartilhem silenciosamente uma cópia com semântica de exclusão ambígua. Quando houver biblioteca: distinguir explicitamente “remover do repertório” de “excluir da biblioteca”; a segunda operação rejeita assets referenciados ou exige resolução explícita dos vínculos. Nunca apagar a cópia enquanto outro repertório a utiliza. A separação de entidades já permite isso sem migrar caminhos embutidos em cada botão.

Estado de reprodução é volátil e não entra no JSON. Reiniciar sempre abre parado, sem retomar áudio.

## Módulos, processos e dependências

Organização proposta, a criar incrementalmente (não uma lista de stubs obrigatórios):

```text
src/
  domain/
    catalog.ts                # entidades e integridade das referências
    repertoire.ts             # grade, posições, comandos puros
    transport.ts              # transições puras e tokens
  main/
    bootstrap.ts              # composição, janela e ciclo de vida
    library/commands.ts       # importar, excluir, editar; fila de operações
    storage/library-file.ts   # JSON, revisão, backup, migrations
    storage/managed-audio.ts   # staging, nomes internos e limpeza
    ipc.ts                    # validação e handlers finitos
    media-protocol.ts         # servir áudio por ID autorizado
  preload/bridge.ts
  renderer/
    pad-grid/                 # apresentação e interação
    playback/controller.ts    # único dono do transporte em runtime
    playback/web-audio.ts      # mecanismo concreto
  contracts/desktop-api.ts    # DTOs/comandos/resultados serializáveis
```

Direção: UI → controller → domínio; commands do main → domínio + adapters concretos; adapters dependem de APIs externas. Domínio não importa React, Electron, Node, DOM, storage ou contracts de IPC. Main e renderer compartilham regras puras quando útil, não objetos vivos nem estado mutável. `contracts` não vira pasta `shared` com utilitários sem dono. Imports diretos e composição explícita bastam; não criar packages separados.

Interfaces pequenas só em fronteiras usadas: mecanismo de áudio com `start(asset, runId)`, `stop(runId)` e notificações `started/ended/failed`; API desktop com `loadLibrary`, `importIntoPad`, `removePadAudio`, `updatePad`. Um adapter concreto de arquivo pode expor `load` e `commit(next, expectedRevision)`, sem `IRepository<T>`, CRUD genérico ou abstração para banco remoto hipotético. Não implementar dois adapters só para demonstrar extensibilidade.

O main resolve IDs a arquivos internos e pode servir URLs por protocolo local, sem aceitar caminhos arbitrários enviados pelo renderer. Electron oferece `protocol.handle`; escolher esquema/permissões mínimos e validar ID, origem e confinamento à pasta gerenciada. Não expor `readFile(path)` ou `ipc.invoke(channel, ...args)` genéricos. [API protocol](https://www.electronjs.org/docs/latest/api/protocol).

Dados gerenciados ficam em subpasta própria de `app.getPath('userData')`, não no bundle, assets do repositório ou diretório de trabalho; Electron fornece esse caminho por plataforma. Não presumir separadores ou sensibilidade a maiúsculas. [API app/getPath](https://www.electronjs.org/docs/latest/api/app#appgetpathname).

## Transporte e exclusão mútua com edição

Estados internos recomendados: `stopped`, `loading(assetId, runId)`, `playing(assetId, runId)`, `stopping(runId)`, `editing(operationId)`. Loading/stopping/editing são travas operacionais; não introduzem pausa.

| Entrada | Condição | Resultado |
|---|---|---|
| clique em pad preenchido | stopped e biblioteca pronta | loading; reservar runId e iniciar do zero |
| clique em qualquer pad | loading/playing/stopping | ignorar; não enfileirar troca |
| STOP | loading | invalidar runId; retorno a stopped, carga atrasada não pode tocar |
| STOP | playing | stopping; parar source; liberar somente após confirmação |
| ended/erro | runId atual | liberar source; stopped; erro visível quando aplicável |
| callback antigo | token diferente | ignorar |
| editar/importar/excluir | stopped | editing até concluir ou falhar |
| editar/importar/excluir | outro estado | rejeitar com motivo |
| tocar | editing | rejeitar até operação terminar |

O controller único do renderer arbitra intenção de tocar e de editar antes de cruzar IPC. O main mantém fila única, revisão esperada e recusa comandos concorrentes; não confia no fato de um botão estar desabilitado. A fila evita dois imports sobre a mesma revisão. Nenhuma edição dispara uma chamada direta ao disco fora desse fluxo.

Não manter dois transportes independentes em main e renderer. Com uma única janela confiável e API finita, o coordenador local bloqueia tocar enquanto aguarda uma edição. Antes de adicionar segunda janela, atalhos nativos ou outro produtor de comandos, mover a arbitragem global de leases/estado para main e exigir confirmação do renderer ao parar. Não anunciar que uma flag replicada por IPC garante atomicidade entre processos.

Renderer destruído implica áudio perdido: a V1 deve assumir STOP na recriação da janela e não retomar execução. Se for requisito continuar áudio após crash da UI, o dono do áudio precisa ser outro processo: é uma mudança de requisito, não algo resolvido por organização de pastas.

## Adapter de áudio: decisão condicionada a teste real

Recomendo começar um spike com Web Audio para início determinístico do buffer e controle explícito do source. `start(0, 0)` com source novo, `loop=false`, sem misturar sources. `ended` também pode ocorrer após STOP: tratar por token, não como comando para tocar o próximo. A especificação define esse ciclo de vida; não garante tempo de resposta específico do hardware. [Web Audio](https://www.w3.org/TR/webaudio-1.0/).

Não decodificar automaticamente as 30 faixas longas. Estimativa própria: PCM float estéreo a 48 kHz ocupa 48.000 × 2 × 4 bytes/s; uma faixa de cinco minutos ocupa aproximadamente 110 MiB, trinta cerca de 3,2 GiB, fora cópias e overhead. Opções: cache limitado/preparação enquanto parado com indicação de prontidão, ou um único `HTMLAudioElement` para arquivos longos com menor controle de início. Escolher após medir memória, tempo até o primeiro som e STOP no Mac real. Nenhuma opção exige trocar o domínio; somente adapter e política de preparação. Não prometer latência de instrumento/tempo real rígido em Electron.

Confirmar formatos aceitos com arquivos reais no Electron empacotado dos dois sistemas; validar estéreo e rejeitar áudio inválido/mono/multicanal com mensagem clara, sem conversão silenciosa na V1. Saída, interface USB, retomada de suspensão e desconexão do dispositivo entram no ensaio de produção.

## Persistência: JSON agora, SQLite se houver pressão concreta

| Critério | JSON versionado | SQLite |
|---|---|---|
| V1 com uma grade e um escritor | simples, inspecionável, snapshot pequeno | viável, mas mais integração |
| Relações/consultas crescentes | validação manual e regravação total | constraints, índices e transações |
| Arquivos de áudio externos | exige protocolo de consistência | também exige esse protocolo |
| Recuperação | backup, validação, revisão e reconciliação próprios | journal/transações; ainda precisa backup e política de migração |

**Escolha proposta:** JSON, não por incapacidade do SQLite, mas porque consultas e concorrência atuais não justificam integração adicional. SQLite é adequado como formato de aplicação segundo sua própria documentação, mas isso não prova vantagem para este pad. [Application file format](https://sqlite.org/appfileformat.html).

Se escolher binding nativo de SQLite, considerar rebuild/ABI do Electron e distribuição por plataforma/arquitetura. A documentação oficial explica essa exigência; não pressupor que todo acesso SQLite precisa de binding externo, nem que `node:sqlite` estará disponível na versão embutida escolhida. [Native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

Commit JSON proposto: serializar mutações; validar próximo snapshot; preservar backup validado da revisão anterior; escrever temporário único no mesmo diretório; sincronizar/fechar; substituir destino por rename; só então publicar nova revisão. Nunca apagar o destino primeiro para contornar erro de rename. Falha deve preservar último estado confirmado e apresentar erro; o aplicativo não pode aparentar que salvou.

**Inspiração concreta, não prova de adequação:** o código real de `npm/write-file-atomic` implementa temporário, fsync, rename, limpeza e serialização por arquivo. Pode evitar reimplementar detalhes; avaliar versão e comportamento no Windows/Mac antes de adotar. [Código](https://github.com/npm/write-file-atomic/blob/main/lib/index.js), [README](https://github.com/npm/write-file-atomic/blob/main/README.md).

Rename/flush não equivalem a garantia universal contra queda de energia: durabilidade inclui metadados de diretório, filesystem e hardware. Testar interrupção de processo e documentar o limite; evitar vender “JSON atômico” como transação completa de diretório. [Node fs](https://nodejs.org/api/fs.html), [hipóteses de atomicidade SQLite](https://www.sqlite.org/atomiccommit.html).

## Arquivos e metadados: protocolo recuperável

Importação, mantendo edição bloqueada:

1. Selecionar origem no main; gerar ID/nome interno, sem usar nome original como destino.
2. Copiar para staging exclusivo; validar tamanho, leitura/decodificação e dois canais. Copiar antes de validar evita depender de origem alterada depois da validação.
3. Fechar e promover para nome final único na mesma área gerenciada. Não sobrescrever outro asset.
4. Commit único do snapshot com asset + vínculo no pad. Só então responder sucesso.
5. Se falhar antes do commit, tentar limpar staging/final; se falhar limpeza, registrar pendência. Arquivo promovido sem referência é órfão recuperável; referência a arquivo ainda não promovido seria falha mais perigosa.

Excluir na V1: commit remove vínculo e asset e registra nome em `pendingDeletes` no mesmo snapshot; depois unlink da cópia e commit remove pendência. Se unlink falhar, manter pendência e informar que remoção física está pendente, sem alegar sucesso completo. No próximo início parado, repetir; arquivo já ausente conta como concluído. Nunca apagar origem. Não implementar desfazer sem definir retenção das cópias.

Ao iniciar, antes de habilitar reprodução: validar schema/referências e conferir arquivos; repetir exclusões pendentes; remover staging abandonado; apresentar assets ausentes como indisponíveis, sem tentar tocar. Órfãos não reconhecidos devem ir para quarentena ou ser apresentados para limpeza, não apagados indiscriminadamente: podem pertencer a backup recuperável. Backup de metadados não recupera áudio já excluído; backup completo inclui snapshot e cópias consistentes. A V1 não deve prometer restauração integral com apenas `.bak`.

## Migrations e recuperação

`schemaVersion` explícito desde o primeiro snapshot. Migrações sequenciais e testáveis transformam cópia em memória; validar resultado e salvar pelo mesmo commit. Preservar backup anterior à migração, não sobrescrevê-lo a cada passo. Versão futura desconhecida bloqueia escrita com mensagem útil; nunca reinterpretar como biblioteca vazia. JSON truncado/corrompido: preservar arquivo, oferecer recuperação de backup validado e indicar eventual perda de revisão. Sem backup válido, exigir recuperação explícita, não reset automático.

Gatilhos para SQLite: biblioteca com consultas/filtragem importantes, relações e constraints difíceis de manter, múltiplos escritores necessários ou custo mensurável de snapshots. Manter IDs e nomes internos, converter JSON validado em uma transação, conferir contagens/referências e só então trocar o armazenamento, preservando origem. No SQLite, versionar com `user_version`, migrar em transação quando suportado, habilitar/verificar foreign keys e usar verificações de integridade; não desligar journaling/sincronização para “otimizar”. WAL não é requisito de um escritor com poucos comandos. [PRAGMAs oficiais](https://www.sqlite.org/pragma.html), [riscos e recuperação](https://www.sqlite.org/howtocorrupt.html).

## Testes e caminho incremental

Testar comportamento, não estrutura de pastas:

- Domínio: clique ativo/segundo pad ignorados, STOP antes de trocar, fim natural, ausência de pause/loop, edição bloqueada, posições únicas e asset inexistente rejeitado.
- Controller com adapter falso controlável: STOP durante decode; resposta `started` atrasada; `ended` após STOP e novo play; cliques rápidos; falha de reprodução; tentativa de tocar durante commit. Contar sources vivos: nunca mais de um.
- Disco real temporário e falhas injetadas: falta de espaço/permissão, falha em copy/rename/unlink, encerramento entre cada etapa; reiniciar e verificar que nenhuma referência confirmada aponta para cópia ainda não criada e que exclusões pendentes convergem.
- Fixtures de migração/corrupção: versões antigas, versão futura, JSON truncado, backup inválido, órfãos e áudio ausente. Erro não pode recriar silenciosamente biblioteca vazia.
- Integração Electron empacotada em Windows e Mac: IPC validado, arquivo copiado continua funcionando após mover origem, excluir não afeta origem, reprodução real estéreo, STOP e fim natural. Ensaio longo offline no Mac/interface de produção; não concluir qualidade sonora só por testes unitários.

Ordem proposta: (1) domínio e invariantes; (2) spike de áudio com faixas reais para decidir buffer/cache versus streaming; (3) uma fatia completa importar → salvar → tocar → STOP → excluir; (4) recuperação e testes de falha antes de usar em show; (5) UI final de 20–30 pads; (6) biblioteca e múltiplos repertórios somente quando pedidos. Documentar contratos e cenários junto do módulo e manter composição explícita facilita alterações por agentes sem uma infraestrutura adicional.

## Ressalvas

Não foram executados benchmarks, app Electron, testes de codecs ou ensaios de crash neste repositório. A pesquisa fundamenta mecanismos e trade-offs; as propostas não constituem validação de palco. Permanecem a confirmar: duração típica dos arquivos, formatos permitidos, limite exato de pads, orçamento de latência/memória, interface de áudio e política de backup. Nada disso exige construir uma arquitetura distribuída antecipadamente.
