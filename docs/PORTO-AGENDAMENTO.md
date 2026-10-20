# Porto: pendentes de agendamento

Em **Novo conteúdo**, escolha **Porto · pendentes de agendamento**, na categoria Operações.

1. Clique em **Importar / substituir planilha** e selecione a exportação `.xls` ou `.xlsx` de **PENDENTE AGENDAMENTO/CONFIRM. ENVIADA** do ERP.
2. Confira a data de referência. Ela fica registrada no conteúdo: os cálculos são uma fotografia dessa data, sem envelhecer silenciosamente uma base antiga.
3. Assista ao preview, salve, adicione à programação e publique para as TVs desejadas.

Para atualizar, edite o mesmo conteúdo e importe a nova planilha, ajuste a referência, salve e publique novamente. Cada arquivo substitui integralmente a base anterior.

O painel considera que todos os registros dessa exportação estão pendentes de agendamento. Não importe uma lista geral que inclua processos já agendados: o arquivo não fornece uma coluna para distinguir esses casos.

As colunas obrigatórias são Código do processo, Dt. chegada, Porto de destino, Remetente e Destinatário. São aceitos até 1.000 processos e arquivos de até 5 MB. Códigos repetidos usam a primeira ocorrência e a quantidade ignorada aparece na importação. Datas inválidas impedem a substituição; datas posteriores à referência são excluídas dos alertas e sinalizadas.

O cálculo usa dias corridos, com chegada como dia zero. A partir de 3 dias entra em alerta; a partir de 7 recebe destaque crítico. A média e o maior tempo consideram somente os processos em alerta. Há uma tela de resumo e páginas de seis processos, ordenados pelo maior tempo parado. A duração sugerida é dez segundos por tela, ajustável respeitando o mínimo de cinco.

Os dados importados ficam no conteúdo salvo e na publicação, permitindo reprodução offline pelo player. A leitura do Excel ocorre no navegador, com a biblioteca servida pelo próprio GeoTV.

A primeira tela de detalhes destaca os cinco processos com maior tempo parado, sem repeti-los nas páginas seguintes. Os processos com exatamente três dias ficam limitados a seis em toda a apresentação. Os demais continuam aparecendo, com seis por página. Os totais, a média e o maior tempo do resumo consideram toda a base, e o rodapé informa quando apenas parte dos alertas está sendo exibida.
