# GeoTV: Render + Supabase

O Render executa o servidor Node.js e o frontend via Docker. O Supabase armazena o PostgreSQL e as mídias. Com essa configuração, os dados persistentes não dependem do disco do Render. SQLite continua disponível somente para instalações locais sem `DATABASE_URL`.

## Variáveis no Render

Em **Environment**, mantenha as variáveis já cadastradas e confira:

| Nome                      | Valor                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`            | URL PostgreSQL do pooler Supabase, porta 6543, com a senha real codificada para URL |
| `SUPABASE_URL`            | URL HTTPS do seu projeto Supabase, como `https://SEU-PROJETO.supabase.co`           |
| `SUPABASE_SECRET_KEY`     | Chave secreta de servidor, disponível em Settings → API Keys                        |
| `SUPABASE_STORAGE_BUCKET` | `geotv-media` (padrão; opcional)                                                    |
| `PUBLIC_ORIGIN`           | URL HTTPS real do GeoTV no Render, sem barra no final                               |
| `GEOTV_ADMIN_EMAIL`       | E-mail para entrar no GeoTV                                                         |
| `GEOTV_ADMIN_NAME`        | Nome do administrador                                                               |
| `GEOTV_ADMIN_PASSWORD`    | Senha do GeoTV com pelo menos 12 caracteres                                         |

Se estiver usando as chaves legadas, cadastre `SUPABASE_SERVICE_ROLE_KEY` com a chave **service_role** no lugar de `SUPABASE_SECRET_KEY`. Não use a chave anon/publishable. Não envie chaves no chat, não as coloque no frontend e não versione `.env`.

`DIRECT_URL` pode continuar cadastrada, mas o servidor não a utiliza: tanto as consultas quanto a criação inicial das tabelas usam `DATABASE_URL`. Não é necessário Prisma nem executar SQL manualmente no painel.

O Docker configura `HOST=0.0.0.0`, `COOKIE_SECURE=true` e LibreOffice. O servidor usa `PORT` fornecida pelo Render. `GEOTV_STORAGE` guarda apenas conversões temporárias no modo Supabase; não é preciso criar disco persistente. Não importe o `.env` local inteiro, pois contém origens HTTP locais.

## Banco e arquivos

Na primeira inicialização, o GeoTV cria as tabelas no schema **geotv**, preservando tabelas e registros existentes. Para vê-las no Table Editor do Supabase, escolha o schema `geotv`. Esse schema não precisa ser exposto na Data API: o backend conecta diretamente ao PostgreSQL e continua validando as permissões do GeoTV. Mantenha-o privado, sem conceder acesso aos papéis anon/authenticated.

O administrador inicial só é criado quando não existem usuários. Alterar `GEOTV_ADMIN_PASSWORD` não redefine senhas já cadastradas.

O servidor verifica o bucket `geotv-media` e o cria como **privado** se não existir. Também é possível criá-lo manualmente em Storage, com Public bucket desativado. Se o bucket já existir como público, a inicialização para e pede que ele seja configurado como privado.

Uploads, exclusões e leitura usam a chave apenas no backend. As apresentações mantêm URLs `/media/...`; vídeos continuam aceitando intervalos de bytes. O servidor não revela URLs assinadas nem chaves ao navegador. A rota `/media/...` mantém o comportamento anterior de acesso por quem possuir o link; bucket privado não equivale a autenticação adicional nessa rota.

Os limites de upload do Supabase dependem do plano, do limite global e do bucket. O GeoTV aceita imagens até 10 MB e vídeos até 100 MB, mas o limite do Supabase pode ser menor. Nesse caso, reduza o arquivo ou ajuste o limite/plano. Importar PDF/PowerPoint gera imagens das páginas, guardadas no Storage; o original convertido é temporário.

## Deploy e validação

1. No serviço Render, use o repositório GeoTV, branch `main`, runtime **Docker**, Dockerfile `./Dockerfile`, Root Directory e Docker Command vazios.
2. Use **Virginia** se o projeto Supabase estiver em `us-east-1`.
3. Salve as variáveis e publique o commit atualizado. Use Health Check Path **`/health`**.
4. Abra o endereço HTTPS e faça login. Crie conteúdo, envie uma foto, publique em um canal e teste a reprodução.
5. Reinicie o serviço e confirme que login, conteúdo e foto continuam disponíveis. Teste PowerPoint com os arquivos reais para avaliar memória.

O modo PostgreSQL não faz fallback silencioso para SQLite ou upload local se faltar configuração. Falhas de configuração devem ser corrigidas nos logs/Environment. A conexão verifica o certificado TLS. Se houver erro de certificado, obtenha a CA do banco no painel Supabase e configure `DATABASE_CA_CERT` com o PEM (aceita `\n` escapado); não desative a verificação TLS.

O plano gratuito do Render pode suspender o serviço por inatividade e exige espera para reativação. Banco e objetos ficam no Supabase, mas os limites e condições dos dois planos continuam aplicáveis. Para TVs corporativas contínuas, dimensione disponibilidade, memória e tráfego; LibreOffice pode exceder a memória de instâncias pequenas.

## Dados existentes e backups

Esta mudança não importa nem exclui o banco e as mídias do computador. Uma base Supabase vazia começa com uma instalação nova. Não envie um arquivo `.sqlite` para PostgreSQL: transferir os dados existentes exige uma importação própria, preservando IDs e arquivos. Até lá, mantenha a instalação local e seu backup intactos.

A base local e a hospedada não se sincronizam automaticamente. Faça backups do PostgreSQL e dos objetos do Storage separadamente e teste a restauração. Histórico de publicações não substitui backup.

## Testes executáveis

`npm test` inclui regressão da API e do navegador no modo local, consultas/transações com PostgreSQL embarcado PGlite e testes do contrato de Storage (upload, Range, HEAD e remoção). PGlite e mocks não validam a rede ou as credenciais do projeto Supabase real: a validação final ocorre após configurar o serviço e fazer o deploy.

Referências: [conexão Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [chaves](https://supabase.com/docs/guides/api/api-keys), [buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [limites de upload](https://supabase.com/docs/guides/storage/uploads/file-limits), [Render Free](https://render.com/docs/free).
