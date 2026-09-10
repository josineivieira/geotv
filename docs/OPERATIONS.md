# Instalação e operação

## Configuração inicial

Para hospedagem com PostgreSQL e Supabase Storage, siga [Render + Supabase](RENDER.md). As instruções de cópia da pasta `storage` abaixo se aplicam ao modo SQLite local; no Supabase, faça backup do banco e dos objetos separadamente.

Execute `npm run setup`, consulte a credencial no `.env` e execute `npm start`. O banco é criado na primeira execução. O administrador só é criado quando não existem usuários e a senha configurada tem pelo menos 12 caracteres.

Variáveis:

| Variável             | Uso                                           |
| -------------------- | --------------------------------------------- |
| PORT                 | Porta HTTP; padrão 3000                       |
| HOST                 | Interface; padrão 127.0.0.1                   |
| PUBLIC_ORIGIN        | Origem exata vista pelo navegador             |
| COOKIE_SECURE        | `true` atrás de HTTPS                         |
| GEOTV_STORAGE        | Diretório persistente de banco e mídia        |
| GEOTV_ADMIN_EMAIL    | E-mail do primeiro administrador              |
| GEOTV_ADMIN_PASSWORD | Senha inicial; mínimo 12 caracteres           |
| GEOTV_ADMIN_NAME     | Nome do primeiro administrador                |
| CHROME_PATH          | Executável do Chrome para testes de navegador |

## Produção e TVs

Instalar como serviço com reinício automático usando a infraestrutura da empresa. Expor por proxy reverso HTTPS. Manter arquivos de banco e mídia em volume local persistente; não colocar o arquivo SQLite em compartilhamento de rede.

Exemplo de configuração Nginx dentro do servidor TLS já configurado pela infraestrutura:

```nginx
client_max_body_size 101m;
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_read_timeout 90s;
}
# Configure logs sem query string para não registrar credenciais EventSource.
```

O rate limiting usa o IP da conexão direta. Atrás de proxy, TVs compartilham esse limite. Para frotas maiores, implementar identificação de IP apenas por proxies confiáveis e limites separados por dispositivo. Não confiar indiscriminadamente em X-Forwarded-For.

A URL de ativação é exibida apenas no cadastro ou renovação. Renovar invalida a credencial antiga. A TV desconectada continuará com a publicação já armazenada, mas não receberá novas versões até ser reativada. Não existe apagamento remoto garantido de uma TV sem conexão.

Configure inicialização automática do navegador, fullscreen/kiosk, desligamento de suspensão, relógio via NTP, permissões de armazenamento persistente e bloqueio de navegação local conforme o equipamento. Um site não consegue impor essas configurações sozinho.

## Backup

Para um backup simples e consistente, pare o serviço e copie o diretório `storage/` completo, incluindo banco e mídia, para o destino de backup da empresa. Reinicie após a cópia. Para backup online, implementar procedimento com a API de backup do SQLite e coordenação com uploads. Não copie apenas `geotv.sqlite` durante uma escrita: WAL pode conter transações ainda não consolidadas.

Teste a restauração em outro diretório. Preserve o `.env` separadamente no gerenciador de segredos autorizado. Histórico de publicações não é backup do banco.

## Homologação antes de ampliar a frota

- TV real: leitura a distância, resolução, suporte a JavaScript, Service Worker, IndexedDB e codecs.
- Reprodução contínua por pelo menos 72 horas, observando memória, decodificação e espaço de cache.
- Perda de rede, recarga offline, reinício do servidor, reconexão e atualização de conteúdo.
- Expiração de aviso urgente offline e comportamento ao não existir conteúdo elegível.
- Limites reais de arquivos e quantidade de dispositivos no proxy.
- Recuperação de backup, política de retenção e administração de usuários.

Essas verificações de hardware e longa duração não foram realizadas automaticamente nesta entrega.
