# Validação física S1

Estado inicial de todos os itens abaixo: **NOT RUN**. Preencher com resultado,
data, evidência e falha observada. Não promover ensaio a aprovação por silêncio.

Execute no Mac, após extrair o candidato completo:

```sh
bash docs/release/collect-mac.sh '/Applications/Mr. Emo Virtual Pad.app' "$HOME/Desktop/pad-evidencia-$(date +%Y%m%d-%H%M%S)"
```

Guarde também ZIP, seu SHA-256, commit e relatório do job escolhido. O script
coleta hardware, saída de áudio, OS, versão do bundle, arquitetura, assinatura,
avaliação do Gatekeeper e hash do ASAR. Os metadados podem conter identificadores
da máquina; confira antes de compartilhar. Registre Electron/Chromium do relatório
automatizado da mesma build. Execute os cenários abaixo com originais duplicados
para teste, mantendo os originais de produção protegidos.

| Cenário            | Evidência a preencher                                                                                                                       | Resultado |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Entrega            | Arquitetura, origem do download, ZIP/hash, primeira abertura e eventual bloqueio                                                            | NOT RUN   |
| Repertório         | Lista dos arquivos reais da banda, hash, extensão, codec/container, duração; importar e tocar cada um até o fim                             | NOT RUN   |
| Edição             | 31 pads, nome/cor/ordem, fechar/reabrir e conferir; rolar até o fim mantendo STOP acessível                                                 | NOT RUN   |
| Exclusividade      | A tocando, clicar B e A novamente; somente A continua; STOP, B começa do zero                                                               | NOT RUN   |
| Interface          | Modelo, driver/firmware, taxa de amostragem, buffer, OS output selecionado; fixture L/R conhecida e cabos/mesa comprovando canais separados | NOT RUN   |
| Start/STOP         | Método abaixo, amostras brutas e limites acordados com baterista                                                                            | NOT RUN   |
| Ensaio offline     | Wi-Fi/rede desligados, duração real em horas, repertório e falhas/glitches registrados                                                      | NOT RUN   |
| Fechar             | Cancelar fechamento ocupado mantém faixa; confirmar fecha; reabrir parado                                                                   | NOT RUN   |
| Suspender          | Suspender durante reprodução, acordar; não retomar automaticamente; STOP e nova faixa funcionam                                             | NOT RUN   |
| Interface removida | Desconectar/reconectar durante execução; registrar silêncio/erro/saída escolhida; nenhuma faixa seguinte automática                         | NOT RUN   |
| Reinício/falha     | Fechar forçado apenas perfil de teste; reabrir parado, catálogo íntegro, originais intactos                                                 | NOT RUN   |
| Biblioteca         | Copiar/restaurar biblioteca inteira com app encerrado em ambiente de teste e conferir pads/bytes                                            | NOT RUN   |
| Delete/recuperação | Excluir pad confirmado só remove cópia interna; simular falha somente em perfil descartável, corrigir acesso e reabrir; preservar mensagens | NOT RUN   |

Para latência, registre antes do ensaio os limites aceitáveis de início e STOP
com o baterista. Baseline é a mesma máquina/interface/arquivo e configuração
registrados, em repouso, sem outras cargas. Use gravação externa que capture
simultaneamente a ação física e a saída da interface, por exemplo vídeo de alta
taxa de quadros com áudio e clique visível. Documente sincronização e resolução
(um quadro a 240 fps equivale a cerca de 4,17 ms; isso é resolução, não latência).
Se usar loopback, documente a latência adicional da captura e como a calibrou.

Faça pelo menos 20 inícios e 20 STOP, incluindo primeiro disparo após abrir e
arquivo longo. Meça ação até primeiro som e ação até silêncio no mesmo relógio.
Guarde cada amostra e reporte mediana, máximo e incerteza contra os limites
acordados, com hardware e método. Progress/timeupdate ou relógio JS não medem
saída física. Se o método não resolver o limite, registre inconclusivo.

Aprovação exige resultados observados para cada item e limites satisfeitos.
Falha de dispositivo/codec exige diagnóstico e novo ensaio; não declarar suporte
por extensão de arquivo. Não há número de desempenho medido neste documento.
