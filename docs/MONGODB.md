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
5. Somente após sucesso, copie o valor de `MONGODB_URI` para `DATABASE_URL` no
   `.env` e reinicie o servidor. `MONGODB_URI` sozinha não ativa o MongoDB.
6. Confira `/health`, login, programação e um Player. Mantenha o SQLite e o backup.

As imagens e vídeos não ficam nas coleções: preserve `storage/media` no mesmo
servidor ou mantenha o Supabase Storage já configurado. Em hospedagem Render o
Storage remoto continua obrigatório. Mudar para outro servidor também exige
transferir os arquivos ou configurar o armazenamento remoto.

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
e [operações atômicas](https://www.mongodb.com/docs/drivers/node/current/crud/compound-operations/).
