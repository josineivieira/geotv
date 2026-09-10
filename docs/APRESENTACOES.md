# Suas imagens e o acesso das TVs

## Criar uma apresentação

1. Abra **Novo conteúdo → Minha apresentação**.
2. Clique em **Adicionar fotos** e selecione várias imagens, ou use **Importar PDF / PowerPoint**. Você também pode selecionar imagens da biblioteca.
3. Arraste as miniaturas ou use as setas para ordenar. Use **×** para remover uma tela.
4. Selecione uma miniatura e defina duração, transição, enquadramento e texto opcional.
   Para mudar a apresentação inteira, use **Tempo e efeito de todas as telas → Aplicar a todas as telas**. A duração total é calculada; em **Programação**, clique em **Editar telas** para ajustar os tempos da apresentação.
5. Clique em **Reproduzir preview** para assistir à sequência. Cada tela pode usar fade, deslizar, zoom leve ou nenhum efeito.
6. Marque **Adicionar à programação** e salve. A duração total é calculada pela soma das telas.
7. Publique para as TVs escolhidas. Para reutilizar a apresentação no mês seguinte, duplique o conteúdo.

As imagens aceitas são JPG, PNG e WEBP, com até 10 MB por arquivo. Documentos PDF, PPT e PPTX podem ter até 40 MB. Cada apresentação aceita até 60 telas, de 5 a 300 segundos por tela, com total máximo de uma hora. Imagens importadas ficam na biblioteca e podem ser reutilizadas.

O PDF.js converte PDF no navegador do Admin, em imagens de até 1920 × 1080. PowerPoint é convertido localmente pelo LibreOffice no servidor e depois segue o mesmo processo. Não é utilizado serviço externo de conversão. A importação é sequencial e mostra progresso; em caso de erro, as telas já importadas permanecem no editor e precisam ser salvas para compor o conteúdo.

PowerPoint: instale LibreOffice no servidor. Nesta máquina ele já foi instalado. Em outra instalação, use o caminho padrão ou configure `LIBREOFFICE_PATH` no `.env` apontando para o executável `soffice`. Apenas um PowerPoint é convertido por vez, com limite de 90 segundos e perfil temporário isolado com macros desabilitadas. Arquivos com senha precisam ser desbloqueados antes da importação.

As páginas importadas são imagens estáticas: animações, áudio e vídeos incorporados do PowerPoint não são preservados; a apresentação usa os efeitos escolhidos no GeoTV. Fontes ausentes no servidor podem ser substituídas pelo conversor. Revise o preview antes de publicar. Esta função reproduz a sequência na TV, sem exportar um arquivo MP4.

Execute `npm ci` em novas instalações para instalar o PDF.js. Dependências e assets do importador são servidos localmente. Referências de implementação: [PDF.js](https://mozilla.github.io/pdf.js/examples/) e [conversão por linha de comando do LibreOffice](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html).

## Acesso de televisão

Use o link gerado em **TVs → Nova TV** no navegador do equipamento. A credencial desse link só permite ler a publicação atribuída, receber notificações e enviar heartbeat. Ela não autoriza acesso ao Admin, usuários, biblioteca ou edição.

O perfil **Visualizador** é de uma pessoa que consulta o painel administrativo; não é um perfil de TV. Não mantenha uma sessão de administrador aberta no equipamento usado como TV. Para bloquear navegação física para outros sites, configure o navegador em modo kiosk no equipamento.

## Exclusão

Em **Programação**, use **Excluir programação**. Os conteúdos do acervo e versões publicadas são preservados; TVs permanecem na última publicação até que outra seja enviada. Excluir a última playlist abre uma nova vazia.

Em **TVs**, use **Excluir TV**. O link é invalidado e os avisos deixam de apontar para o dispositivo. Um Player conectado e atualizado interrompe a reprodução ao receber a revogação; um dispositivo offline só toma conhecimento quando reconecta. Players que já estavam abertos antes desta atualização precisam ser recarregados para receber o novo código.
