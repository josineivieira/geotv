# GeoTV na rede local

O projeto usa um servidor Node customizado em `server/index.js`. Admin, API e Player são atendidos pelo mesmo processo e porta. Os scripts `npm start` e `npm run dev` carregam o `.env` automaticamente.

Configuração desta instalação:

```dotenv
PORT=3010
HOST=0.0.0.0
PUBLIC_ORIGIN=http://10.176.0.55:3010
ALLOWED_ORIGINS=http://127.0.0.1:3010,http://localhost:3010,http://10.176.0.55:3010
COOKIE_SECURE=false
```

`HOST` define o bind. `PUBLIC_ORIGIN` e `ALLOWED_ORIGINS` autorizam as origens das requisições do navegador; não são permissões de usuário nem substituem autenticação. A lista é explícita, sem wildcard. Se o IPv4 mudar, atualize as duas configurações de origem e reinicie.

Na pasta do projeto, execute:

```powershell
npm start
```

Ou `npm run dev` para reiniciar automaticamente quando houver alterações no código. Não execute os dois simultaneamente na mesma porta. Após editar o `.env`, reinicie o processo.

No próprio servidor: `http://localhost:3010/` ou `http://127.0.0.1:3010/`.
Nas TVs, celulares e outros computadores: `http://10.176.0.55:3010/`.

Verifique com `netstat -ano | findstr :3010`: o listener deve ser `0.0.0.0:3010`.

Se outro dispositivo não conectar, a porta **TCP 3010** pode precisar de uma regra de entrada no Windows Defender Firewall, limitada à rede corporativa autorizada. Também verifique isolamento de Wi-Fi/VLAN com a TI. Não desative o firewall. Nenhuma regra de firewall é criada pelo projeto.

HTTP na LAN permite servir o sistema, mas não disponibiliza Service Worker em uma origem IP não segura. O cache offline do Player requer HTTPS (localhost é uma exceção de desenvolvimento). Para uso permanente nas TVs, configure HTTPS com certificado confiável nos equipamentos. Esta alteração de rede não modifica o comportamento de cache do Player.
