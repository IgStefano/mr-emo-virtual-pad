# Electron e áudio local — pesquisa para o pad da banda

Data: 2026-11-13. Escopo: pesquisa documental; nenhum spike, código de app ou configuração foi implementado. Fontes primárias consultadas na web. **Evidência** identifica comportamento documentado; **proposta** identifica decisão própria para este projeto, ainda sujeita a ensaio no Mac de produção. Repositório inicial: README e assets, sem convenção de documentação.

## Decisão recomendada

**Proposta:** Electron + TypeScript + Forge/Vite, uma janela sandboxed, um controlador de reprodução fora dos componentes visuais e um único `HTMLAudioElement` ativo. Main cuida de arquivos, persistência e permissões; preload oferece uma API estreita; renderer controla o transporte. Nenhum servidor HTTP, FFmpeg externo, banco, processo de áudio próprio ou cache de 30 faixas decodificadas no V1.

O contrato é: 20–30 pads, um arquivo estéreo por pad; tocar sempre do início; nenhuma pausa; pad ativo ignorado; outro pad bloqueado até STOP; fim natural libera; editar/importar/excluir somente parado. Uma grade persistida. `pause()` pode ser usado internamente para implementar STOP, sem criar uma função de pausa para o usuário.

## Fronteiras de processo e segurança

**Evidência:** Electron recomenda isolamento, sandbox, CSP, validação de remetentes IPC, restrição de navegação e protocolos próprios em lugar de `file:`. Conteúdo local também merece essas proteções. [Checklist oficial](https://www.electronjs.org/docs/latest/tutorial/security).

**Proposta:** explicitar `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`; sem webview, iframes, conteúdo remoto ou HTML vindo de nomes de arquivo. Negar novas janelas, navegação fora da origem do app e permissões não necessárias. Renderizar títulos como texto. Não expor shell nem caminhos arbitrários.

**Evidência:** isolamento separa o contexto do preload do da página; a orientação oficial é expor métodos específicos, não um `ipcRenderer.send` genérico. [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation). O preload sandboxed dispõe de um subconjunto de Node, e o renderer delega operações privilegiadas por IPC. [Sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox).

**Proposta concreta de responsabilidades:**

- Main: diálogo de importação, IDs internos, cópia/exclusão, manifesto versionado, protocolo, uma fila de mutações e concessão exclusiva entre reprodução e edição.
- Preload: ponte `getGrid`, `requestPlaybackLease`, `releasePlaybackLease`, `importIntoPad`, `updatePad`, `deletePad`, assinaturas com unsubscribe. Nenhum `fs`, canal livre ou objeto de evento exposto.
- Renderer: controlador único com máquina de estados; UI só envia intenções e observa snapshots. Nem componente, atalho nem menu chama `audio.play()` diretamente.

**Proposta IPC:** tipos compartilhados para comandos/resultados discriminados e validação runtime no main (TypeScript sozinho não valida dados recebidos). Aceitar apenas IDs, campos conhecidos, tamanho máximo de rótulo, índices válidos e revisão esperada da grade. Erros serializáveis com códigos, sem stack/caminho absoluto. Para cada handler verificar `event.sender === mainWindow.webContents`, frame principal vivo e origem exata permitida via parser de URL; rejeitar subframes e remetentes de janela anterior. Não usar `startsWith` de URL. Revalidar a sessão após todo diálogo/await. A exigência de validar todos os remetentes está no [guia de segurança](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages).

**Proposta CSP de produção:** `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; media-src pad-media://library; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'`. Servir como header do protocolo da UI; ajustar apenas recursos realmente usados. Dev com Vite precisa de política separada para localhost/HMR, nunca incorporada ao pacote. Não usar bypass de CSP no protocolo.

## Autoridade única e corridas

**Evidência:** `play()` tem conclusão assíncrona; `pause()` e `load()` podem rejeitar promessas pendentes com `AbortError`; `ended` também chega por tarefa assíncrona. Portanto clique não equivale a som confirmado. [Algoritmos normativos HTML](https://html.spec.whatwg.org/multipage/media.html#media-elements).

**Proposta:** o controlador do renderer é a única autoridade sobre transporte; o main é exclusivamente o árbitro do acesso ao acervo. A concessão no main não é um segundo player nem afirma que há som. Estados mínimos: `stopped`, `acquiring`, `starting`, `playing`, `stopping`, `editing`, `fault`. `acquiring/starting` já bloqueiam outros pads e edição. Durante edição, reprodução é recusada.

Cada tentativa recebe geração crescente e lease associado à sessão da janela. Não manter fila que espere `play()` resolver: STOP precisa interromper imediatamente.

1. Em `stopped`, reservar sincronicamente `acquiring` antes de qualquer await; pedir lease ao main. Main concede apenas sem mutação em andamento e registra a revisão/asset.
2. Se a geração ainda for atual, criar um elemento para essa tentativa, conectar callbacks que capturam elemento/geração, atribuir URL imutável e iniciar do zero. Nunca deixar dois elementos aptos a tocar.
3. Resolver `play()` só promove a `playing` se elemento, geração e lease ainda coincidirem. Falha atual causa limpeza e erro visível; falha antiga não altera tentativa nova.
4. STOP incrementa geração imediatamente, chama `pause()`, remove `src`, chama `load()` e descarta callbacks/elemento. Libera lease depois da limpeza; não espera a promessa de play. Se lease chegar depois do STOP, liberar sem tocar. Resultado tardio só pode limpar o elemento antigo, nunca pausar o novo.
5. `ended` ou erro só finalizam a geração atual. STOP repetido é idempotente. Clique no ativo e nos demais durante tentativa/reprodução é ignorado; não há troca automática.
6. Só anunciar `stopped` e permitir nova tentativa/edição após a liberação ser reconhecida. Se IPC falhar, ficar em falha bloqueada até recuperação, não presumir que o main liberou.

**Proposta para impedir TOCTOU:** concessão de reprodução e início de mutação são decisões serializadas no main, sem await entre verificar e reservar. Importação reserva exclusividade **antes** de abrir diálogo, e a mantém durante cópia/commit. Renderer entra em edição antes do IPC. Revisão e token impedem conclusão antiga após STOP, fechamento ou cancelamento. Não confiar apenas no botão desabilitado. Isso resolve play versus importação/exclusão sem mover áudio para main.

## Protocolo de mídia e ranges

**Evidência:** `protocol.handle` retorna `Response`; protocolo pertence à sessão da janela; privilégios são registrados antes de ready. A documentação orienta `stream: true` para respostas em streaming usadas por audio/video e mostra encaminhamento a `net.fetch(fileURL)`. Isso não constitui garantia explícita de ranges para qualquer combinação de versão e wrapper. [Protocol](https://www.electronjs.org/docs/latest/api/protocol).

**Proposta:** UI em `pad-app://app/`; mídia em `pad-media://library/<assetId>`. Registrar esquemas standard/secure e mídia streaming, sem bypassCSP. Main resolve ID no manifesto, nunca concatena pathname recebido com diretório. Aceitar somente host, método e formato de ID esperados; impedir traversal, separadores codificados, symlinks escapando da raiz e enumeração arbitrária. Onde disponível, validar `initiatorOrigin`; verificar disponibilidade na versão fixada, pois docs latest podem ser mais novas. O protocolo é uma fronteira própria: validação IPC não o protege.

**Proposta mínima:** experimentar encaminhar `Range` ao `net.fetch` de URL interna criada com `pathToFileURL`, preservando status/headers/body. Não ler arquivo inteiro para criar `Response`. Verificar o resultado no pacote; não assumir que `net.fetch(fileURL)` sem headers implementa a necessidade. Se falhar, implementar handler pequeno de bytes com stream limitado, cancelamento e backpressure.

**Evidência:** range satisfatível usa `206` com `Content-Range`; intervalo insatisfatível pode responder `416` com `Content-Range: bytes */N`; `Accept-Ranges` anuncia suporte. [RFC 9110, ranges](https://www.rfc-editor.org/rfc/rfc9110.html#section-14).

**Proposta de teste/contrato:** GET sem range retorna 200, MIME correto e comprimento; HEAD retorna headers sem corpo; testar `bytes=0-`, faixa limitada, sufixo, fim maior que arquivo, intervalo fora do tamanho e arquivo vazio. Não emitir 206 com corpo inteiro. Para multi-range não implementado, ignorar Range e retornar 200 completo é opção mais simples que multipart; não classificar automaticamente como insatisfatível. Fixar arquivos imutáveis por ID, cancelar streams ao abortar, limitar leituras concorrentes e não manter locks depois de STOP. Buscar início e metadados pode exigir ranges mesmo sem botão de seek.

## Motor: custo versus benefício

| Opção | Evidência | Decisão própria para este app |
| --- | --- | --- |
| HTMLAudioElement | Transporte, buffering, eventos e promises definidos no [HTML](https://html.spec.whatwg.org/multipage/media.html#media-elements). `preload` é uma indicação, não compromisso de carregamento. | Primeira escolha para faixas longas, uma por vez. Não promete latência determinística; medir início frio e STOP físico. Não criar 30 elementos com preload auto. |
| Web Audio / AudioBuffer | Buffer PCM em memória, canais float32; fontes têm ciclo de vida próprio e API de agendamento. [W3C Web Audio](https://www.w3.org/TR/webaudio/). A edição 1.1 consultada é Working Draft, não garantia de implementação Electron. | Bom se disparo previsível de samples curtos virar requisito. Carregar 30 músicas inteiras é desnecessário. Um buffer estéreo de 5 min/48 kHz custa 115,2 MB decimais; 30 ≈ 3,46 GB, só PCM (cálculo próprio: segundos × taxa × 2 × 4). |
| Elemento + grafo Web Audio | Web Audio integra media elements e processamento no grafo. [Especificação](https://www.w3.org/TR/webaudio/). | Adiar até precisar de ganho, medidor ou efeitos; não elimina custo do decoder nem garante início rápido. |
| Processo próprio/nativo | `utilityProcess` oferece processo Node separado, não um motor de áudio pronto. [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process). | Só após falha mensurada da solução simples ou requisito nativo claro. Acrescenta IPC, binários por arquitetura, supervisão, distribuição e STOP entre processos. |

**Proposta de formatos:** começar com WAV PCM estéreo 16/24-bit em 44,1/48 kHz como contrato de produção; provar ambos e rejeitar formatos não ensaiados com mensagem clara. MP3/FLAC podem entrar após matriz real; AAC/M4A não é promessa inicial. Extensão não comprova codec nem estéreo. `canPlayType` é triagem, não validação de arquivo completo. Validar cabeçalho WAV/canais no main e testar reprodução; não usar decodeAudioData de todas as músicas apenas para obter metadados.

**Evidência:** suporte de codecs depende da configuração do Chromium/FFmpeg, e Chrome tem diferenças de codecs proprietários. Uma tabela de Chrome não prova o pacote Electron escolhido. [Chromium audio/video](https://www.chromium.org/audio-video/). **Proposta:** fixar versão Electron, testar fixtures no binário empacotado de cada SO, não instalar pacotes de codec nem trocar ffmpeg do runtime no V1. Copiar sem converter evita nova dependência; formato inválido exige exportação externa pelo usuário.

## Arquivos e evolução do domínio

**Proposta:** `userData/media/<assetId>.<ext>` e manifesto JSON versionado, fora do ASAR e do diretório de instalação. Copiar para temporário, validar, renomear para ID definitivo, gravar manifesto em temporário e substituir; tratar cada erro sem publicar referência quebrada. Manter última versão válida e limpar temporários/orphans na inicialização. Renomear arquivo e manifesto não é uma transação conjunta nem promessa de durabilidade após queda de energia.

Para excluir: primeiro persistir remoção da referência, depois apagar cópia interna; falha de unlink deixa órfão registrado para nova tentativa e aviso de limpeza pendente. Não anunciar remoção física antes do sucesso. Nunca apagar original. Testar Windows com handles ainda abertos e liberar mídia antes de excluir. Sem deduplicação no V1: cada importação tem cópia própria, reduzindo ambiguidade de exclusão.

Separar no manifesto `assets` de `pads` (pad guarda assetId), embora exista só uma grade. Isso prepara biblioteca e repertórios sem implementá-los. No futuro, exclusão de pad e exclusão de asset precisarão virar comandos distintos e considerar referências de outros repertórios; não transportar a regra destrutiva do V1 sem migração.

## Ciclo de vida, dispositivos e falhas

**Evidência:** Electron expõe `render-process-gone` e eventos de falta de resposta no [webContents](https://www.electronjs.org/docs/latest/api/web-contents), e `child-process-gone`/single instance no [app](https://www.electronjs.org/docs/latest/api/app). **Proposta:** instância única; fechar a janela encerra o app também no Mac, sem áudio escondido. Fechamento normal executa STOP; renderer morto invalida sessão/leases; não retomar faixa após reload ou crash. Falta de resposta não comprova silêncio: manter edição bloqueada, oferecer encerrar/recriar janela. Main crash e falha do serviço de áudio exigem ensaio: não prometer continuidade ou silêncio instantâneo.

**Evidência:** `prevent-app-suspension` mantém sistema ativo permitindo tela apagar, com exemplo oficial de áudio. [powerSaveBlocker](https://www.electronjs.org/docs/latest/api/power-save-blocker). **Proposta:** ativar durante lease de reprodução, liberar em STOP/fim/erro/fechamento. Não tratar como proteção contra tampa fechada ou suspensão forçada; voltar de suspensão parado, nunca retomar automaticamente.

**Evidência:** `setSinkId` é assíncrono, depende de contexto seguro/permissões e pode falhar por dispositivo inexistente ou troca abortada. [W3C Audio Output Devices](https://www.w3.org/TR/audio-output/). **Proposta:** V1 usa saída padrão do sistema, escolhida antes do show; seletor interno só se necessário e comprovado no Electron fixado. Não solicitar microfone para tocar arquivo. `devicechange`, unplug USB e troca do padrão precisam de testes; se detectado erro/troca, parar e exigir nova ação, sem fallback deliberado para alto-falante interno. A detecção pode ser incompleta: o V1 não garante evitar todo reroteamento automático do SO. Se isso for requisito obrigatório de palco, o spike de dispositivo passa a bloquear a arquitetura. Bluetooth não é referência de latência; usar interface cabeada real.

## Ferramentas, fuses e distribuição

**Evidência:** Forge coordena package/make e por padrão constrói para o SO anfitrião. [Build lifecycle](https://www.electronforge.io/core-concepts/build-lifecycle). **Proposta:** Forge + plugin Vite + TypeScript para unificar build e entrega com pouca cola. Desenvolver no Windows, mas gerar/assinar/ensaiar release Mac em Mac ou CI macOS. Primeiro mirar arquitetura do Mac usado; universal só se houver necessidade real.

**Evidência com divergência documental:** a [página antiga do template Vite](https://www.electronforge.io/templates/vite) ainda o chama experimental desde 7.5; o [release oficial Forge 8](https://github.com/electron/forge/releases) declara plugin estável, ESM e Node ≥22.17. **Proposta:** escolher uma linha de versões coerente, fixar lockfile e conferir release notes antes do scaffold; não repetir a classificação antiga como verdade atual. Vite é ferramenta de build, não garantia de segurança/áudio.

**Evidência:** electron-vite reúne configurações main/preload/renderer e HMR. [Guia do projeto](https://electron-vite.org/guide/). **Trade-off próprio:** alternativa válida se a equipe preferir essa organização, mas ainda precisa de uma solução de empacotamento/assinatura, como [electron-builder](https://www.electron.build/docs/). Não usar electron-vite e plugin Vite do Forge como duas pipelines sobrepostas. Vite manual economiza dependência de integração mas transfere reload, caminhos e empacotamento ao projeto; pouco benefício aqui. Nenhuma dessas escolhas reduz por si o runtime Chromium distribuído.

**Evidência:** assinatura e notarização são etapas distintas para distribuição Mac; Forge integra ambas e documenta requisitos Apple/Xcode. [Signing macOS](https://www.electronforge.io/guides/code-signing/code-signing-macos). **Proposta:** testar app instalado/assinado e com quarentena, não apenas dev; gerar artefato Windows para smoke test e Mac para palco. Aplicativo funciona offline, mas preparação/notarização não é fluxo totalmente offline. Evitar dependências nativas reduz matriz ABI/arquitetura, sem eliminar testes por SO.

**Evidência:** fuses são alterados antes de assinar; há opções para RunAsNode, NODE_OPTIONS, inspector, integridade ASAR e carregamento exclusivo de ASAR. Integridade é documentada para Mac e Windows. [Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses). **Proposta:** no release desativar RunAsNode, NodeOptions e NodeCliInspect; habilitar OnlyLoadAppFromAsar e EmbeddedAsarIntegrityValidation com metadados corretos do empacotador. Verificar binário final e smoke test depois. Fuses não validam mídia importada nem protegem manifesto em userData. Não adotar bytecode/ofuscação ou snapshots próprios.

## Spike mínimo e critérios de saída

Propostas de ensaio, ainda não executadas; thresholds devem ser acordados com a banda antes de aprovação para palco.

1. **Áudio no Mac real:** um elemento, protocolo e arquivo de duração típica; medir clique→primeira amostra e STOP→silêncio físico por loopback externo/gravação. Separar início frio/quente, silêncio inicial do arquivo e atraso do dispositivo; relatar p50/p95/pior caso, sem confundir `playing` com som na saída. Referência provisória: início p95 ≤100 ms e nenhum início tardio após STOP; se insuficiente, comparar um único AudioBuffer pré-carregado antes de migrar motor.
2. **Corridas determinísticas:** atrasar lease, rede/protocolo e resolução play; STOP antes/depois de cada conclusão; A→B sem STOP; A→STOP→B; eventos antigos; double click; importar/excluir enquanto starting; diálogo aberto e fechamento; erro de cópia/disco cheio. Aceite: nunca sobrepor faixas, nunca tocar após cancelamento, nenhuma edição com lease ativo, nenhum evento antigo alterar tentativa atual.
3. **Protocolo/pacote:** fixtures de ranges e travessia; Unicode/espaços; nomes iguais; arquivo truncado; estéreo conhecido L/R; WAV formatos aceitos e arquivos rejeitados; origem original removida após importar. Medir memória com 30 pads e faixa longa: não pode crescer proporcionalmente ao PCM das 30 faixas. Confirmar liberação de handles no Windows.
4. **Palco:** rodar repertório por horas no Mac com interface USB, taxas 44,1/48 kHz, volume e canais reais; carga de CPU/disco, janela em background/minimizada, tela apagada, unplug/replug, troca do padrão, suspensão/retorno e saída indisponível. Registrar dropouts, crashes e roteamento inesperado. Não aceitar teste só no Windows como evidência de prontidão Mac.
5. **Recuperação:** matar renderer/serviço de áudio e encerrar main; reiniciar durante cópia/manifesto; conferir grade íntegra, órfãos recuperáveis, ausência de autoplay e mensagem explícita de falha. Testar artefato final com fuses/assinatura, fora do ambiente dev.

Se o primeiro spike falhar apenas em latência, comparar Web Audio sem antecipar biblioteca completa. Se falhar em roteamento seguro ou sobrevivência de áudio a crash da UI, reabrir requisito e isolamento do motor; não adicionar processo próprio como solução presumida. A pesquisa não prova latência, compatibilidade de cada codec, silêncio instantâneo ou estabilidade no hardware da banda.
