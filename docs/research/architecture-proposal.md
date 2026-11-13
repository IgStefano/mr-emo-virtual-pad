# Proposta consolidada de arquitetura

> Revisão posterior: [proposta v2](architecture-proposal-v2.md), com SQLite desde V1, lint amplo, mutação desde o primeiro comportamento e harness verificável. Este arquivo preserva a proposta inicial para comparação.

Status: proposta para discussão, 2026-11-13. Nenhum código/configuração do app implementado.

Base: [guardrails](agent-guardrails.md), [runtime e áudio](electron-runtime-audio.md), [evolução](scalable-architecture.md). Essas notas contêm fontes primárias e limitações. As decisões abaixo são recomendações para este projeto, não consenso da indústria.

## Decisão principal

Um único projeto/pacote, TypeScript, Electron, React para apresentação e módulos com interfaces pequenas. Forge + Vite é a opção inicial de build/distribuição; conferir compatibilidade das versões antes do scaffold. Não sobrepor Forge/Vite e electron-vite como duas pipelines. Sem monorepo, servidor, contêiner de DI ou processo de áudio próprio nesta etapa.

Escalar significa acrescentar funcionalidades e manter alterações localizadas, não atender tráfego de servidores.

## Organização e direção de dependências

```text
src/
  domain/                 # entidades, integridade e transições puras
    playback.ts
    repertoire.ts
    catalog.ts
  contracts/              # DTOs e schemas IPC, sem Electron/Node/DOM
  main/
    bootstrap.ts          # composição, janela, ciclo de vida
    ipc/                  # handlers, validação e coordenação de acesso
    library/              # importação, alteração e exclusão
    storage/              # manifesto, migrations, arquivos gerenciados
    media/                # protocolo local por ID
  preload/                # bridge finita
  renderer/
    playback/             # controlador e adapter HTMLAudioElement
    performance/          # grade e transporte visível
    editing/              # importação, nome, cor, reordenação
```

Main, preload e renderer podem importar contracts; main e renderer podem importar domain. Domain só importa domain; contracts não importa implementações e pode usar validador explicitamente autorizado. Main/preload/renderer não importam implementações uns dos outros. Áudio DOM somente no adapter; disco somente no armazenamento main. Composition root conecta os módulos explicitamente. Estrutura é orientação, não obrigação de criar arquivos vazios.

Contratos serializáveis não são o modelo de estado inteiro nem uma pasta shared genérica. Quando um comando transporta uma entidade, definir DTO intencional; não duplicar todos os tipos sem necessidade.

## Reprodução e coordenação entre processos

Escolha inicial: HTMLAudioElement, com apenas um elemento apto a tocar por vez. Um novo elemento pode ser criado por tentativa para isolar callbacks antigos. React não possui o elemento nem chama play diretamente; um controlador único possui a sessão. Transições puras expressam stopped/acquiring/starting/playing/stopping/editing/fault; nenhum booleano paralelo cria uma segunda interpretação do estado.

O main arbitra exclusividade de acesso ao acervo: ou há concessão de reprodução ou há edição. Não é outro controlador de áudio. Verificar e reservar acontece sem await intermediário; operações de disco são serializadas. Importação reserva edição antes de abrir diálogo. Concessão é vinculada à sessão viva da janela, não a um isPlaying enviado pela UI.

Cada tentativa recebe geração. STOP invalida a geração antes de qualquer await, interrompe/limpa o elemento e libera a concessão. Se concessão ou play concluir depois, não pode começar áudio nem alterar a tentativa nova. Falha de IPC impede anunciar liberação não confirmada. Eventos antigos são ignorados. Esse mecanismo precisa de testes determinísticos, não só testes de botões desabilitados.

Escolha resolve divergência das notas: streaming é a primeira opção para faixas completas; Web Audio é alternativa se medição mostrar problema de início. Não pré-decodificar todas as músicas. A título de cálculo, 30 faixas estéreo de 5 minutos a 48 kHz/float32 representam cerca de 3,46 GB de PCM, sem overhead. Isso não é medição deste app.

Crash da UI não garante continuidade de áudio; recriação sempre abre parada. Exigência futura de áudio independente da UI reabre a decisão de processo. Instância única evita duas cópias do app reproduzindo juntas.

## Modelo e armazenamento

Separar AudioAsset (arquivo gerenciado), Pad (nome, cor, assetId) e Repertoire (lista ordenada de pads com IDs estáveis). Na V1 há um repertório padrão. Ordem vem da lista, sem campo position redundante. Não criar slots vazios ou teto de 30 por suposição: 20–30 é dimensão de uso, não limite de produto.

Um manifesto JSON versionado contém esses dados e revisão; mídia fica separada numa pasta gerenciada sob userData. Estado de reprodução não é persistido. Um único escritor, temporário/substituição, última cópia válida, validação e migrations desde o primeiro schema. Bibliotecas futuras podem exigir SQLite, mas SQLite não torna áudio externo parte de uma transação.

Importação: copiar para staging, validar, promover arquivo por ID e só depois publicar referência no manifesto. Falha pode deixar órfão recuperável, nunca uma referência publicada antes da cópia. Exclusão: persistir remoção e pendência de limpeza, apagar cópia, confirmar limpeza; repetir falhas no próximo início. Nunca apagar original. Backup de manifesto não recupera mídia já apagada.

Na V1 cada importação tem cópia própria; não deduplicar. Futuramente remover pad do repertório e excluir asset da biblioteca tornam-se comandos distintos. JSON desconhecido/corrompido não vira biblioteca vazia automaticamente.

Não restringir silenciosamente o produto a WAV nem rejeitar mono/multicanal sem decisão: as notas sugerem possíveis contratos de formatos, mas isso ainda exige conhecer os arquivos reais. Validar o que é efetivamente suportado no runtime escolhido; não confiar apenas em extensão ou canPlayType.

## Guardrails executáveis

- TypeScript: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes; tsconfigs por ambiente evitam Node/DOM disponíveis indevidamente.
- ESLint + typescript-eslint recommendedTypeChecked: no-explicit-any, família no-unsafe, no-floating-promises com ignoreVoid false, no-misused-promises e switch-exhaustiveness-check. Formatter separado, sem duplicar fiscalização de estilo.
- dependency-cruiser: matriz de imports, ciclos e imports não resolvidos; conferir aliases, imports de tipos e reexports. Um único mecanismo de grafo, sem adicionar boundaries em paralelo.
- Produção com imports estáticos inicialmente; proibir require e import dinâmico para não escapar da matriz. Exceções mínimas e justificadas quando houver necessidade concreta.
- Renderer sem Electron/Node; preload só bridge; domain sem APIs ambientais. Testes de configuração efetiva de janela e superfície exposta.
- IPC e manifesto tratados como unknown e validados por schema (Zod é candidato); checar remetente/frame/origem, campos e IDs. Context isolation, sandbox, CSP e protocolo de mídia restrito por ID continuam obrigatórios.
- Sem supressão global para obter verde. Supressão local exige motivo, escopo mínimo e evidência; detectar diretivas inúteis. CI não comprova que um motivo é verdadeiro.
- CI: instalação por lockfile, format check, lint sem warnings, typecheck, grafo e testes; smoke/build empacotado Windows/macOS antes de release. Proteção de branch precisa ser configurada para esses checks serem bloqueantes.

AGENTS.md curto deve apontar para spec, arquitetura e comandos reais. Documentação orienta agentes; checks detectam violações limitadas. Nenhum mecanismo impede sozinho que um agente altere ou enfraqueça o próprio check: mudanças nas guardrails precisam de revisão.

## Validação e decisões ainda abertas

Vitest é candidato para transições/controller e integração de disco real temporário; Playwright para poucos fluxos Electron (integração Electron experimental, confirmar versão). Não exigir cobertura percentual ou limite de linhas arbitrário. Testar especialmente STOP durante início pendente, callbacks antigos, exclusão concorrente, falha de gravação e recuperação.

Primeiro experimento: importar e servir uma faixa real pelo protocolo no Electron empacotado; medir início/STOP, memória, codecs e saída no Mac/interface da banda. Resultado do evento playing não é medição de som físico. Ranges do protocolo precisam de teste mesmo sem seek na UI. Web Audio ou motor nativo só após evidência.

Ainda não decididos: formatos reais usados, tolerância de atraso no disparo, versão/arquitetura do Mac, comportamento real da saída em desconexão. Usar padrão de saída do SO não garante impedir reroteamento automático para alto-falantes. Esses itens condicionam o spike, sem bloquear a discussão da estrutura.

## Fontes principais

- [OpenAI: harness engineering](https://openai.com/index/harness-engineering/): experiência primária com instruções no repo e enforcement; não prova consenso.
- [VS Code ESLint](https://github.com/microsoft/vscode/blob/main/eslint.config.js) e [instruções](https://github.com/microsoft/vscode/blob/main/AGENTS.md): exemplos reais Electron/TypeScript, sem recomendação de copiar sua escala.
- [Electron: segurança](https://www.electronjs.org/docs/latest/tutorial/security), [processos](https://www.electronjs.org/docs/latest/tutorial/process-model) e [protocolos](https://www.electronjs.org/docs/latest/api/protocol).
- [HTML media elements](https://html.spec.whatwg.org/multipage/media.html#media-elements): semântica assíncrona de reprodução.
- [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/) e [dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).
- [SQLite atomic commit](https://www.sqlite.org/atomiccommit.html) e [write-file-atomic](https://github.com/npm/write-file-atomic): mecanismos e limites da persistência.
