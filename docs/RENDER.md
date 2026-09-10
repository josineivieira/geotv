# GeoTV no Render

O projeto usa Node.js 24, servidor HTTP próprio e SQLite. Frontend e API ficam no mesmo Web Service. Não precisa criar Postgres para esta instalação: trocar o banco exigiria uma migração do código e dos dados.

## Configuração

1. Envie o código para um repositório privado no GitHub. Não envie `.env`, `storage`, `node_modules` nem backups. O banco e as mídias locais não são parte do deploy.
2. No Render, escolha **New > Web Service**, conecte o repositório e selecione **Docker**, com `./Dockerfile`. Deixe Docker Command vazio para usar o comando da imagem.
3. Escolha uma instância paga e confira os custos antes de criar. Conversões de PowerPoint podem exigir mais memória: dimensione com seus arquivos reais.
4. Adicione um disco persistente com mount path **`/var/data`**. Escolha capacidade suficiente para o banco, mídias e conversões temporárias. Mantenha apenas uma instância deste serviço SQLite.
5. Configure as variáveis abaixo na área Environment. Substitua o domínio pelo endereço real atribuído ao serviço, sem barra no final.

| Variável               | Valor                                               |
| ---------------------- | --------------------------------------------------- |
| `PUBLIC_ORIGIN`        | `https://SEU-SERVICO.onrender.com`                  |
| `GEOTV_ADMIN_EMAIL`    | Seu e-mail de administrador                         |
| `GEOTV_ADMIN_NAME`     | Seu nome                                            |
| `GEOTV_ADMIN_PASSWORD` | Senha forte exclusiva, com pelo menos 12 caracteres |

O Docker já configura `HOST=0.0.0.0`, `COOKIE_SECURE=true`, `GEOTV_STORAGE=/var/data/geotv` e `LIBREOFFICE_PATH=/usr/bin/libreoffice`. O servidor respeita a variável `PORT` fornecida pelo Render. Não copie o `.env` local: ele contém endereços HTTP da LAN e configurações de cookies locais. `ALLOWED_ORIGINS` pode ficar sem definição quando tudo usa o mesmo domínio. Se alterar o domínio, atualize `PUBLIC_ORIGIN`.

6. Configure Health Check Path como `/` e inicie o deploy. Esse caminho verifica a resposta HTTP da página, não é um diagnóstico completo do banco.
7. Abra o endereço HTTPS, faça login, cadastre um conteúdo, envie uma imagem e publique em um canal. Reinicie o serviço e confirme que os dados e a mídia continuam disponíveis. Teste também uma importação de PowerPoint e a reprodução em uma TV.

O Docker instala LibreOffice e fontes para converter PowerPoint. A imagem precisa ser construída e validada no Render; preparar estes arquivos não publica o serviço.

## Dados que já estão no computador

O primeiro deploy com disco vazio cria uma instalação nova. Para levar os dados existentes, será necessário transferir uma cópia consistente de **toda a pasta `storage`**, incluindo banco e mídias, para `/var/data/geotv`. Faça o backup local com o GeoTV parado e planeje a restauração com o serviço de destino parado; não sobrescreva um SQLite em uso. Guarde o backup fora do repositório. As credenciais do banco restaurado serão mantidas; as variáveis de administrador só criam o primeiro usuário em um banco novo.

Não dependa apenas do disco: mantenha backups consistentes fora do serviço. A instalação local e a hospedada não se sincronizam automaticamente. Reabra os canais pelo novo domínio e refaça o acesso das TVs conforme necessário.

## Limites desta instalação

- O plano gratuito não oferece disco persistente: SQLite e uploads seriam perdidos em reinícios ou deploys.
- SQLite com disco atende uma instância. Escalar para várias instâncias exige rever banco, armazenamento de mídia e notificações.
- As URLs diretas dos arquivos de mídia são públicas para quem possuir o link. Avalie isso antes de enviar conteúdo corporativo confidencial para uma hospedagem pública.

Referências oficiais: [discos persistentes](https://render.com/docs/disks), [limitações do plano gratuito](https://render.com/docs/free) e [Web Services](https://render.com/docs/web-services).
