# MongoDB Atlas

O TV GEO aceita uma conexão `mongodb+srv://` em `DATABASE_URL`. O banco padrão é
`geotv`; prefira informá-lo no caminho da conexão. O driver verifica TLS. O Atlas
deve permitir o IP do servidor e o usuário precisa ler e gravar no banco, criar
coleções e índices. Transações exigem um replica set (como o oferecido pelo Atlas).

## Migrar o SQLite atual

1. Configure `MONGODB_URI` no `.env` com a conexão de destino e a senha real, sem
   os marcadores `<` e `>`. Codifique caracteres especiais da senha com percent
   encoding. Não coloque a conexão em comandos, commits ou logs.
2. Execute `npm run migrate:mongodb` para conferir a prévia local. Esse comando
   não conecta ao Atlas. A origem padrão é `storage/geotv.sqlite`; pode ser
   alterada com `MIGRATION_SQLITE_PATH` ou `GEOTV_STORAGE`.
3. Pare todas as instâncias que gravam no SQLite e execute
   `npm run migrate:mongodb -- --apply --source-stopped`.
4. O comando cria um backup consistente em `storage/backups/`, incluindo o WAL,
   e importa em uma transação. O destino deve estar vazio: registros existentes
   impedem a importação, sem sobrescrita. IDs, hashes de senha, tokens, textos
   JSON e históricos são preservados. Contagens e SHA-256 verificam a cópia.
5. Transfira também os arquivos com os comandos da seção de mídias abaixo.
6. Somente após sucesso, copie o valor de `MONGODB_URI` para `DATABASE_URL` no
   `.env` e reinicie o servidor. `MONGODB_URI` sozinha não ativa o MongoDB.
7. Confira `/health`, login, programação e um Player. Mantenha o SQLite e o backup.

## Imagens e vídeos no MongoDB

Com `DATABASE_URL` MongoDB, todos os novos uploads usam automaticamente GridFS
no mesmo banco, nas coleções `geotv_media.files` e `geotv_media.chunks`.
As variáveis `SUPABASE_*` são ignoradas nesse modo, inclusive no Render.
Os caminhos `/media/...`, os nomes dos arquivos e as publicações permanecem iguais.
A leitura suporta HEAD e intervalos de bytes para vídeos.

Para transferir arquivos existentes em `storage/media`:

```powershell
npm run migrate:mongodb-media
# Pare o servidor que grava os arquivos de origem antes da transferência:
npm run migrate:mongodb-media -- --apply --source-stopped
```

A prévia consulta o MongoDB e verifica os arquivos locais sem gravar no destino.
A transferência inclui arquivos locais e verifica referências no catálogo,
conteúdos e publicações históricas. Arquivos ausentes ou divergentes impedem a
transferência; recupere qualquer arquivo que exista apenas no Storage antigo.
Tamanho e SHA-256 são verificados após a leitura dos bytes armazenados no GridFS.
Reexecutar o comando verifica e preserva arquivos já transferidos, sem sobrescrever.
Uma falha pode deixar arquivos já concluídos no destino; execute novamente para
continuar. Os originais locais são preservados e o relatório fica em `storage/backups`.

## Render sem Supabase

Publique o código atualizado e configure `DATABASE_URL` com a conexão do Atlas,
`PUBLIC_ORIGIN` com a URL HTTPS do serviço, `HOST=0.0.0.0` e `COOKIE_SECURE=true`.
Use o Dockerfile do projeto e a porta fornecida pelo Render. Libere as faixas de
IP de saída do Render no Atlas. As variáveis `SUPABASE_*` podem ser removidas.
Não é necessário disco persistente: os arquivos definitivos ficam no MongoDB.
O diretório local é usado apenas para conversões temporárias de documentos.
Faça backup tanto das coleções de registros quanto das duas coleções GridFS.

## Retorno ao banco anterior

Antes de voltar ao SQLite depois de usar o MongoDB, considere as alterações
feitas desde a troca: a origem é uma fotografia anterior e não recebe novas
gravações. A ferramenta importa apenas SQLite para MongoDB; não executa uma
migração reversa ou uma mesclagem de bancos.

## Testes

`npm run test:mongodb` inicia um replica set local descartável com
`mongodb-memory-server` e testa importação, rollback e restrições. O binário pode
ser baixado no primeiro uso. Nenhum teste usa credenciais do Atlas.

O adaptador implementa somente as consultas usadas pelo TV GEO, com valores
vinculados, índices únicos e transações. Consultas SQL novas precisam de cobertura
no adaptador; sintaxes desconhecidas são rejeitadas.

Referências: [transações do driver oficial](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/)
e [GridFS](https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/).
