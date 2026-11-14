# Candidato de ensaio 0.1.0

Este candidato offline prepara a validação do baterista. A aprovação para show
continua pendente de S1 no Mac e na interface reais. Nenhum tempo de resposta ou
codec da banda foi aprovado neste host Linux.

## Escolher e abrir

Em Sobre Este Mac, chip Apple usa `darwin-arm64`; processador Intel usa
`darwin-x64`. Windows de desenvolvimento usa `win32-x64`. Não escolha por Rosetta.
Use o ZIP correspondente e confira seu SHA-256 contra `reports/release/artifacts.json`
do mesmo job/commit (`shasum -a 256 arquivo.zip` no Mac). Identifique sempre versão,
arquitetura e SHA do código, pois 0.1.0 sozinho não distingue candidatos.

Extraia o ZIP pelo Finder e copie o app para uma pasta local. Abra pelo Finder.
Este ensaio não tem assinatura Developer ID nem notarização. Uma assinatura local
ad-hoc, quando presente, não identifica um desenvolvedor aprovado pela Apple.
Se o macOS bloquear um app de origem conferida, use o fluxo normal de Ajustes do
Sistema > Privacidade e Segurança > Abrir Mesmo Assim, quando disponível, e confirme.
Se a política da máquina não permitir, registre o bloqueio; não desative o Gatekeeper.
Não remova quarentena em massa. A primeira abertura pelo caminho real de entrega
é parte da validação, inclusive se for bloqueada.

## Operar

1. Com o app parado, entre em Editar repertório e importe os áudios. O app copia
   e valida os arquivos; não altera os originais. Um formato aceito na importação
   ainda precisa tocar corretamente no runtime e na interface reais.
2. Renomeie, escolha a cor e arraste para ordenar. Conclua a edição. As mudanças
   são salvas automaticamente. Confira após fechar e abrir.
3. Clique em um pad para começar do zero. Cliques em outros pads durante execução
   são ignorados. Use STOP antes de trocar. Não há pausa, avanço automático ou mixer.
   O app usa a saída do sistema e os níveis dos arquivos.
4. Para excluir, pare, edite e confirme a exclusão. Somente a cópia interna é removida.
   Confira o original separadamente. STOP fica disponível durante a rolagem.

## Falhas e biblioteca

Se uma exclusão acusar limpeza pendente, não manipule arquivos internos. Pare,
feche o app, resolva espaço/permissões/acesso ao disco e reabra. A recuperação tenta
as exclusões registradas novamente antes de liberar a sessão. Se o fechamento
falhar, tente fechar novamente após resolver a causa. Não conte com retomada de áudio.
Se persistir, preserve a biblioteca inteira e a mensagem do erro para diagnóstico.
Catálogo corrompido, versão futura ou cópia gerenciada ausente não devem ser
"corrigidos" apagando o banco. Arquivos órfãos e staging podem ir para quarantine;
essa pasta não é um backup nem uma interface de restauração.

O código usa `app.getPath('userData')/library`, com `catalog.sqlite`, `media`,
`staging` e `quarantine`. No Mac o userData padrão deriva do nome do app sob
`~/Library/Application Support`; confirme o diretório criado nesta instalação
antes de copiar. Não confunda um perfil temporário de verificação com a biblioteca
real. Não há exportação/importação de backup no produto.

Para uma cópia manual segura, feche completamente o app e confirme no Monitor de
Atividade que ele saiu. Copie toda a pasta `library` para outro destino, incluindo
arquivos auxiliares SQLite se existirem. Não copie apenas o banco ou apenas media,
nem faça a cópia enquanto o app estiver aberto. Para restaurar com a mesma versão,
feche o app, preserve a biblioteca atual em outra pasta e recoloque a cópia inteira
no mesmo local. Abra e confira quantidade, nomes e reprodução, sempre parado.
Nunca una bancos ou substitua arquivos individuais. Teste a restauração em uma
cópia separada antes de depender dela. Guarde os originais fora da biblioteca.

## Entrega e limites

O CI tem três alvos nativos explícitos, macOS 15 arm64, macOS 15 Intel x64 e
Windows 2025 x64. Os rótulos foram conferidos em 14/11/2026 na
[referência oficial do GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Checkout usa histórico completo para verificar ancestralidade dos acceptedSha.
O job de verificação mantém inventário de mutação e regressões; cada job nativo
empacota ZIP, grava SHA-256/commit/runtime, executa shell, jornada e playback
empacotado. Artefatos e relatórios são preservados mesmo se uma etapa posterior
falhar. A presença de ZIP não equivale ao sucesso do job. Retenção é 30 dias;
o coordenador deve arquivar o candidato escolhido e seus relatórios juntos.

A jornada empacotada semeia o catálogo via importação não empacotada; não prova o
seletor de arquivos do pacote. Sandbox, protocolos restritos, ASAR e fuses de
release permanecem ativos. Assinatura de desenvolvedor/notarização seriam outra
etapa com credenciais Apple; não são pré-requisito do ensaio local.

Nesta execução, CI remoto não foi observado e Mac/Windows não foram executados.
Os ZIPs de cross-build anteriores são evidência estática de outra árvore, não
aprovação deste candidato. Arm64 exige build no macOS para o codesign ad-hoc após
fuses; não se contorna esse requisito no Linux. Consulte a evidência R1 do worker
para comandos locais e resultados. O checklist seguinte mantém todo resultado
físico como NOT RUN até ser preenchido no destino.
