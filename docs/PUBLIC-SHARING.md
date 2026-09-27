# Canal público e capa para compartilhar

Em **TVs**, abra os detalhes da TV e selecione **Compartilhar link público**.
Um administrador pode ativar ou desativar a visualização pública por canal.
O link tem o formato `https://SEU-DOMINIO/public/watch/ID-DA-TV`.

Quem tiver esse link poderá assistir sem login à programação publicada e aos
avisos destinados ao canal. Rascunhos não publicados, credenciais das TVs e
rotas administrativas continuam privados. Os outros canais não se tornam públicos.
Um canal sem publicação ou com compartilhamento desativado responde 404.
As telas abertas verificam a disponibilidade a cada cinco segundos.

O servidor entrega título, descrição e metadados Open Graph no HTML inicial.
A capa PNG de 1200 × 630 fica em `/assets/geotv-cover.png`, acessível sem login.
Configure `PUBLIC_ORIGIN` com o domínio HTTPS correto no Render para que os
endereços da capa e do link canônico sejam absolutos e públicos.

## SharePoint

Cole o link **público** em Links rápidos ou na Web Part de Link. O SharePoint
pode manter prévias em cache ou não gerar a miniatura automaticamente.
Nesse caso, edite o item em Links rápidos, selecione uma imagem personalizada
e use a capa disponível em `/assets/geotv-cover.png` (ou baixe e envie a imagem).
Escolha um layout que mostre miniaturas e publique a página do SharePoint.

Isso compartilha um link para abrir o Player. Não libera incorporação por iframe;
as proteções de enquadramento do aplicativo permanecem ativas.

Para atualizar a arte, edite `scripts/share-cover.html` e execute
`node scripts/render-share-cover.mjs` com Chrome instalado (`CHROME_PATH` opcional).
O PNG é versionado e não exige Chrome no servidor de produção.

Referência: [Links rápidos no SharePoint](https://support.microsoft.com/pt-br/sharepoint/sites-pages/use-the-quick-links-web-part).
