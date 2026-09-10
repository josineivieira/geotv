# GeoTV

Plataforma de canal interno digital com Admin autenticado e Player independente para TVs. Esta entrega é uma primeira versão funcional para homologação, com banco real e publicação versionada; os limites e próximos passos estão em [docs/ROADMAP.md](docs/ROADMAP.md).

## Executar localmente

Requer Node.js 24 ou superior. O servidor usa módulos nativos; não depende de serviço de banco externo.

```powershell
npm ci
npm run setup
npm start
```

Abra **http://localhost:3000**. Entre com `admin@geotv.local` e a senha aleatória `GEOTV_ADMIN_PASSWORD` do arquivo `.env`. O setup não sobrescreve configurações existentes. A senha é usada para criar o primeiro administrador, não para redefinir a senha de uma conta existente.

O `.env` local já foi criado neste workspace. Nenhuma senha padrão é incluída no código. Não compartilhe esse arquivo.

## Primeiro conteúdo na TV

1. Em **TVs → Nova TV**, cadastre nome e grupo. Guarde o link de ativação mostrado uma única vez.
2. Em **Novo conteúdo**, escolha um modelo, preencha os campos e acompanhe o preview.
3. Marque **Adicionar à programação** e salve.
4. Em **Programação**, selecione ou crie uma playlist e organize os itens por arraste ou pelas setas.
5. Clique em **Publicar programação**, selecione TVs individualmente ou por grupo e publique.
6. Abra o link de ativação no navegador da TV. Configure o navegador em tela cheia / kiosk durante a instalação.

Depois de alterar um conteúdo, publique novamente. As TVs recebem uma fotografia da publicação; um rascunho não muda uma transmissão existente. Cada TV pode receber uma playlist e versão diferentes.

## Recursos disponíveis

- Login com sessão HttpOnly, senhas scrypt e quatro perfis autorizados no backend.
- Dashboard com dados reais de dispositivos, publicações, agendamentos e atividades.
- Conteúdos com edição, duplicação, busca, filtros, ativação, arquivamento e exclusão.
- Modelos de ranking, indicadores, comunicados, Rio Negro, mídia e apresentações com várias telas.
- Importação de fotos, PDF e PowerPoint com duração e efeito por tela; veja [o guia de apresentações](docs/APRESENTACOES.md). PowerPoint requer LibreOffice no servidor (já instalado neste computador).
- Preview e Player usam exatamente a mesma função de renderização e CSS.
- Biblioteca com deduplicação por SHA-256, validação de assinatura, MIME, extensão e tamanho.
- Playlists independentes, duração por item, datas, dias da semana e horários recorrentes.
- Publicações imutáveis, restauração como nova versão, seleção por TV/grupo e auditoria.
- Aprovação opcional: o publicador aprova conteúdos antes da publicação.
- Player 16:9 com heartbeat, SSE, recuperação periódica, transições, IndexedDB e Service Worker.
- Avisos urgentes por TV com início, término e cancelamento.
- Contrato de conectores no servidor; integrações com fontes reais ainda não implementadas.

## Rede corporativa

`localhost` só funciona no computador em que o servidor está rodando. Para TVs em outros equipamentos, instale o servidor em um host acessível, com HTTPS e DNS corporativo. Ajuste `PUBLIC_ORIGIN` para a origem pública exata e `COOKIE_SECURE=true`. O servidor deve ficar atrás de um proxy TLS, preferencialmente limitado à rede corporativa.

O Service Worker e o cache persistente exigem **HTTPS**, com exceção de `localhost` para desenvolvimento. Navegadores antigos de Smart TV podem não suportar as APIs utilizadas. Homologue o equipamento; um dispositivo dedicado com Chromium em modo kiosk é uma opção operacional. A página não consegue forçar fullscreen permanente ou ligar fisicamente a TV sem configuração do equipamento.

Veja [operação e implantação](docs/OPERATIONS.md).

## Testes

```powershell
npm ci
npm test
npm run format:check
```

A suíte cobre autorização, rascunho/publicação, restauração, horários e fluxo real no Chrome, incluindo recarga offline. O teste de navegador usa Chrome instalado em `C:/Program Files/Google/Chrome/Application/chrome.exe`; em outro sistema configure `CHROME_PATH`. Ele abre o Chrome sem janela, em perfil temporário, e salva capturas em `test-results/`. Nenhum dado de teste é inserido no banco operacional.

## Organização

```text
server/         HTTP, API, banco, segurança, publicação, upload e conectores
web/admin/      Interface administrativa, editor, views e estilos
web/player/     Reprodução, sincronização e persistência local
web/shared/     Templates, renderização e regras de agendamento
web/sw.js       Cache do Player e entrega de mídia offline
storage/        SQLite e arquivos enviados; fora do versionamento
scripts/        Configuração local
tests/          Testes de regras, integração e navegador
docs/           Arquitetura, implantação e evolução por fases
```

Detalhamento das decisões e do modelo de dados: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
