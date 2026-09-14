import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
test(
  "navegador: login, editor ao vivo, publicação e Player offline",
  { timeout: 180000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "geotv-browser-"));
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 2; i++) {
      const page = pdf.addPage([960, 540]);
      page.drawText("GeoTV PDF demonstracao " + i, {
        x: 80,
        y: 300,
        size: 40,
        font,
        color: rgb(0.3, 0.2, 0.5),
      });
    }
    const pdfPath = join(directory, "demonstracao.pdf");
    await writeFile(pdfPath, await pdf.save());
    const pptxPath = resolve("tests/fixtures/presentation.pptx");
    const port = 45000 + Math.floor(Math.random() * 5000),
      base = `http://localhost:${port}`;
    const password = "Browser-test-password-123";
    const server = spawn(process.execPath, ["server/index.js"], {
      env: {
        ...process.env,
        DATABASE_URL: "",
        SUPABASE_URL: "",
        SUPABASE_SECRET_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        RENDER: "",
        HOST: "127.0.0.1",
        PORT: String(port),
        PUBLIC_ORIGIN: base,
        GEOTV_STORAGE: join(directory, "data"),
        GEOTV_ADMIN_EMAIL: "browser@test.local",
        GEOTV_ADMIN_PASSWORD: password,
      },
      stdio: "ignore",
      windowsHide: true,
    });
    let chrome, ws;
    const pending = new Map();
    let seq = 0;
    const errors = [];
    t.after(async () => {
      ws?.close();
      chrome?.kill();
      server.kill();
      await delay(600);
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
      });
    });
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await delay(100);
    }
    chrome = spawn(
      process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-port=0",
        `--user-data-dir=${join(directory, "chrome")}`,
        "about:blank",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    let debugPort;
    for (let i = 0; i < 100; i++) {
      try {
        debugPort = (
          await readFile(
            join(directory, "chrome", "DevToolsActivePort"),
            "utf8",
          )
        ).split("\n")[0];
        break;
      } catch {}
      await delay(100);
    }
    assert.ok(debugPort, "Chrome iniciou com depuração local");
    const target = await (
      await fetch(
        `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(base)}`,
        { method: "PUT" },
      )
    ).json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => {
      ws.onopen = r;
      ws.onerror = j;
    });
    ws.onmessage = (event) => {
      const m = JSON.parse(event.data);
      if (m.id) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p?.reject(new Error(m.error.message)) : p?.resolve(m.result);
      } else if (m.method === "Runtime.exceptionThrown")
        errors.push(
          m.params.exceptionDetails.text +
            " " +
            (m.params.exceptionDetails.exception?.description || ""),
        );
    };
    const command = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await command("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ||
            "Browser evaluation failed",
        );
      return result.result.value;
    };
    const waitFor = async (expression) => {
      for (let i = 0; i < 100; i++) {
        if (await evaluate(expression)) return;
        await delay(100);
      }
      throw new Error("Timeout: " + expression);
    };
    await command("Runtime.enable");
    await command("Page.enable");
    await command("Network.enable");
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await command("Page.navigate", { url: base });
    await waitFor('!!document.querySelector("#login")');
    await mkdir("test-results", { recursive: true });
    const shot = async (name) => {
      const { data } = await command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(
        resolve("test-results", name + ".png"),
        Buffer.from(data, "base64"),
      );
    };
    await shot("login");
    await evaluate(
      `document.querySelector('[name=email]').value='browser@test.local';document.querySelector('[name=password]').value='${password}';document.querySelector('#login').requestSubmit()`,
    );
    await waitFor('!!document.querySelector(".stats")');
    await shot("dashboard");
    await evaluate(
      `document.querySelector('[data-action=new]').click();document.querySelector('[data-id=goals]').click()`,
    );
    await waitFor('!!document.querySelector("[name=field_annualCurrent]")');
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1590,
      height: 850,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.ok(
      await evaluate(
        `(()=>{const r=document.querySelector('.editor-footer button.primary').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`,
      ),
      "Salvar permanece visível com o editor aberto",
    );
    await evaluate(
      `window.originalSaveFetch=window.fetch;window.fetch=(url,...args)=>String(url)==='/api/contents'?Promise.resolve(new Response(JSON.stringify({error:'Falha simulada de gravação'}),{status:500,headers:{'Content-Type':'application/json'}})):window.originalSaveFetch(url,...args);document.querySelector('#editor-form').requestSubmit()`,
    );
    await waitFor(`!document.querySelector('.editor-save-error').hidden`);
    assert.ok(
      await evaluate(
        `document.querySelector('.editor-save-error').textContent.includes('Falha simulada')`,
      ),
    );
    await evaluate(`window.fetch=window.originalSaveFetch`);
    await command("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(
      `document.querySelector('[name=title]').value='Metas persistidas';document.querySelector('[name=field_annualCurrent]').value=4321;document.querySelector('#editor-form').requestSubmit()`,
    );
    await waitFor('!document.querySelector("#editor-form")');
    const savedGoal = await evaluate(
      `fetch('/api/state').then(r=>r.json()).then(s=>s.contents.find(c=>c.title==='Metas persistidas'))`,
    );
    assert.equal(savedGoal.fields.annualCurrent, "4321");
    await evaluate(
      `document.querySelector('[data-page="Conteúdos"]').click();document.querySelector('[data-action="edit"][data-id="${savedGoal.id}"]').click()`,
    );
    await waitFor('!!document.querySelector("[name=field_annualCurrent]")');
    assert.equal(
      await evaluate(
        `document.querySelector('[name=field_annualCurrent]').value`,
      ),
      "4321",
    );
    await evaluate(
      `document.querySelector('[name=field_annualCurrent]').value=4567;document.querySelector('#editor-form').requestSubmit()`,
    );
    await waitFor('!document.querySelector("#editor-form")');
    assert.equal(
      await evaluate(
        `fetch('/api/state').then(r=>r.json()).then(s=>s.contents.find(c=>c.id==='${savedGoal.id}').fields.annualCurrent)`,
      ),
      "4567",
    );
    await evaluate(
      `document.querySelector('[data-page="Templates"]').click();document.querySelector('[data-id="goals"]').click()`,
    );
    await waitFor('!!document.querySelector("[name=savedContent]")');
    await evaluate(`document.querySelector('#dialog-form').requestSubmit()`);
    await waitFor('!!document.querySelector("[name=field_annualCurrent]")');
    assert.equal(
      await evaluate(
        `document.querySelector('[name=field_annualCurrent]').value`,
      ),
      "4567",
      "reabrir pela galeria permite editar o conteúdo salvo",
    );
    await evaluate(
      `document.querySelector('#close-editor').click();document.querySelector('[data-id="goals"]').click();document.querySelector('#create-from-template').click()`,
    );
    await waitFor('!!document.querySelector("[name=field_annualCurrent]")');
    assert.equal(
      await evaluate(
        `document.querySelector('[name=field_annualCurrent]').value`,
      ),
      "4000",
      "criar novo continua disponível explicitamente",
    );
    await evaluate(`document.querySelector('#close-editor').click()`);
    await evaluate(`document.querySelector('[data-action=new]').click()`);
    await waitFor('!!document.querySelector("[data-action=template]")');
    await evaluate(`document.querySelector('[data-id=sales]').click()`);
    await waitFor('!!document.querySelector("#editor-form")');
    await evaluate(
      `document.querySelector('[name=title]').value='Campanha de demonstração';document.querySelector('[name=field_participants]').value='Fabiola;70\\nAna;50\\nPaulo;40';document.querySelector('[name=demo]').checked=true;document.querySelector('[name=addPlaylist]').checked=true;document.querySelector('[name=title]').dispatchEvent(new Event('input',{bubbles:true}))`,
    );
    assert.ok(
      await evaluate(
        `document.querySelector('#live-preview').textContent.includes('Campanha de demonstração')`,
      ),
    );
    await shot("editor");
    await evaluate(`document.querySelector('#editor-form').requestSubmit()`);
    await waitFor('!document.querySelector("#modal").open');
    const device = await evaluate(
      `fetch('/api/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'TV Demonstração',group:'Testes'})}).then(r=>r.json())`,
    );
    await evaluate(
      `fetch('/api/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({devices:['${device.id}']})}).then(r=>r.json())`,
    );
    await command("Page.navigate", { url: base + device.url });
    await waitFor('!!document.querySelector(".tv-slide")');
    assert.ok(
      await evaluate(
        `document.querySelector('#screen').textContent.includes('Campanha de demonstração')`,
      ),
    );
    assert.equal(await evaluate(`!!document.querySelector('nav')`), false);
    await shot("player");
    await evaluate(
      `(async()=>{const state=await fetch('/api/state').then(r=>r.json());const c=state.contents[0];await fetch('/api/contents/'+c.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...c,title:'Campanha de demonstração — atualizada'})});await fetch('/api/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({devices:['${device.id}']})});})()`,
    );
    await waitFor(
      `document.querySelector('#screen').textContent.includes('atualizada')`,
    );
    await evaluate(
      `fetch('/api/emergencies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Teste de prioridade',message:'Aviso de demonstração',devices:['${device.id}'],start:new Date(Date.now()-1000).toISOString(),end:new Date(Date.now()+3500).toISOString()})}).then(r=>r.json())`,
    );
    await waitFor(
      `document.querySelector('#screen').textContent.includes('Teste de prioridade')`,
    );
    await waitFor(
      `!document.querySelector('#screen').textContent.includes('Teste de prioridade') && document.querySelector('#screen').textContent.includes('atualizada')`,
    );
    await waitFor("!!navigator.serviceWorker.controller");
    await command("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await command("Page.reload");
    await waitFor('!!document.querySelector(".tv-slide")');
    assert.ok(
      await evaluate(
        `document.querySelector('#screen').textContent.includes('Campanha de demonstração')`,
      ),
      "reabre a programação mesmo offline",
    );
    await shot("player-offline");
    await command("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await command("Page.navigate", { url: base });
    await waitFor('!!document.querySelector(".logout-button")');
    assert.ok(
      await evaluate(
        `document.querySelector('.company-logo').complete && document.querySelector('.company-logo').naturalWidth > 0`,
      ),
    );
    await command("Emulation.setDeviceMetricsOverride", {
      width: 768,
      height: 700,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert.ok(
      await evaluate(
        `(()=>{const r=document.querySelector('.logout-button').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()`,
      ),
      "Sair visível em tablet",
    );
    await shot("admin-tablet");
    await evaluate(
      `document.querySelector('[data-page="Templates"]').click();document.querySelector('[data-id="presentation"]').click();document.querySelector('#create-from-template')?.click()`,
    );
    await waitFor('!!document.querySelector("#presentation-images")');
    const { root } = await command("DOM.getDocument");
    const { nodeId } = await command("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "#presentation-images",
    });
    await command("DOM.setFileInputFiles", {
      nodeId,
      files: [
        resolve("web/assets/geomaritima-logo.png"),
        resolve("web/assets/geomaritima-logo.png"),
      ],
    });
    await waitFor(
      `!!document.querySelector('#live-preview img') && document.querySelector('#live-preview img').naturalWidth>0`,
    );
    await evaluate(
      `document.querySelector('[name=title]').value='Minha imagem de teste';document.querySelector('[data-slide-field=showText]').checked=true;document.querySelector('[data-slide-field=showText]').dispatchEvent(new Event('input',{bubbles:true}))`,
    );
    await waitFor(
      'document.querySelectorAll(".presentation-thumb").length===2 && !document.querySelector("#presentation-images").disabled',
    );
    await evaluate(
      `document.querySelector('[data-slide-field=duration]').value=7;document.querySelector('[data-slide-field=duration]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-move="1"][data-offset="-1"]').click()`,
    );
    assert.ok(
      await evaluate(
        `document.querySelector('#live-preview').textContent.includes('Minha imagem de teste')`,
      ),
    );
    await evaluate(`document.querySelector('#editor-form').requestSubmit()`);
    await waitFor('!document.querySelector("#modal").open');
    assert.ok(
      await evaluate(
        `fetch('/api/state').then(r=>r.json()).then(s=>s.contents.some(c=>c.template==='presentation'&&c.slides.length===2&&c.duration===27&&c.slides[0].duration===7))`,
      ),
    );
    await evaluate(`document.querySelector('[data-page="Conteúdos"]').click()`);
    const presentationId = await evaluate(
      `fetch('/api/state').then(r=>r.json()).then(s=>s.contents.find(c=>c.template==='presentation').id)`,
    );
    await evaluate(
      `document.querySelector('[data-action="edit"][data-id="${presentationId}"]').click()`,
    );
    await waitFor('!!document.querySelector("#presentation-apply-all")');
    await evaluate(
      `document.querySelector('#presentation-bulk-duration').value=12;document.querySelector('#presentation-bulk-transition').value='slide';document.querySelector('#presentation-apply-all').click()`,
    );
    assert.equal(
      await evaluate(`document.querySelector('[name=duration]').value`),
      "24",
    );
    assert.equal(
      await evaluate(
        `document.querySelector('[data-slide-field=duration]').value`,
      ),
      "12",
    );
    await evaluate(`document.querySelector('#editor-form').requestSubmit()`);
    await waitFor('!document.querySelector("#modal").open');
    assert.ok(
      await evaluate(
        `fetch('/api/state').then(r=>r.json()).then(s=>s.contents.find(c=>c.id==='${presentationId}').slides.every(slide=>slide.duration===12&&slide.transition==='slide'))`,
      ),
    );
    for (const [path, label] of [
      [pdfPath, "PDF"],
      [pptxPath, "PowerPoint"],
    ]) {
      await evaluate(
        `document.querySelector('[data-page="Templates"]').click();document.querySelector('[data-id="presentation"]').click();document.querySelector('#create-from-template')?.click()`,
      );
      await waitFor('!!document.querySelector("#presentation-document")');
      const tree = await command("DOM.getDocument");
      const input = await command("DOM.querySelector", {
        nodeId: tree.root.nodeId,
        selector: "#presentation-document",
      });
      await command("DOM.setFileInputFiles", {
        nodeId: input.nodeId,
        files: [path],
      });
      for (let attempt = 0; attempt < 900; attempt++) {
        if (
          await evaluate(
            `document.querySelectorAll('.presentation-thumb').length===2 && !document.querySelector('#presentation-document').disabled`,
          )
        )
          break;
        if (attempt === 899)
          throw new Error(
            label +
              ": " +
              (await evaluate(
                `document.querySelector('#presentation-progress').textContent`,
              )),
          );
        await delay(100);
      }
      assert.ok(
        await evaluate(
          `document.querySelector('#live-preview img').naturalWidth>0`,
        ),
      );
      await shot("import-" + label.toLowerCase());
      await evaluate(
        `document.querySelector('[name=title]').value='Importação ${label}';document.querySelector('#editor-form').requestSubmit()`,
      );
      await waitFor('!document.querySelector("#modal").open');
    }
    const sequence = await evaluate(
      `(async()=>{const state=await fetch('/api/state').then(r=>r.json());const c=state.contents.find(c=>c.title==='Importação PowerPoint');c.slides=c.slides.map((s,i)=>({...s,duration:5,transition:i?'zoom':'slide'}));await fetch('/api/contents/'+c.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)});await fetch('/api/playlist',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:state.playlist.id,name:state.playlist.name,items:[{contentId:c.id,duration:10}]})});await fetch('/api/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({devices:['${device.id}']})});return c.slides.map(s=>s.media);})()`,
    );
    await command("Page.navigate", { url: base + device.url });
    await waitFor(
      `!!document.querySelector('#screen .frame:last-child img') && document.querySelector('#screen .frame:last-child img').getAttribute('src')===${JSON.stringify(sequence[0])}`,
    );
    await waitFor(
      `document.querySelector('#screen .frame:last-child img')?.getAttribute('src')===${JSON.stringify(sequence[1])}`,
    );
    assert.ok(
      await evaluate(
        `document.querySelector('#screen .frame:last-child').classList.contains('zoom')`,
      ),
    );
    await command("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await command("Page.reload");
    await waitFor(
      `!!document.querySelector('#screen .frame:last-child img') && document.querySelector('#screen .frame:last-child img').naturalWidth>0`,
    );
    await command("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await command("Page.navigate", { url: base });
    await waitFor('!!document.querySelector(".stats")');
    await evaluate(
      `document.querySelector('[data-page="Programação"]').click()`,
    );
    await evaluate(
      `fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Acesso Canais',email:'canais@test.local',password:'Channels-test-12345',role:'Canais'})}).then(r=>r.json())`,
    );
    await evaluate(`document.querySelector('.logout-button').click()`);
    await waitFor('!!document.querySelector("#login")');
    await evaluate(
      `document.querySelector('[name=email]').value='canais@test.local';document.querySelector('[name=password]').value='Channels-test-12345';document.querySelector('#login').requestSubmit()`,
    );
    await waitFor('!!document.querySelector(".channel-card")');
    assert.equal(await evaluate(`!!document.querySelector('.sidebar')`), false);
    assert.equal(await evaluate(`fetch('/api/state').then(r=>r.status)`), 403);
    await shot("channels");
    await evaluate(`document.querySelector('.channel-card').click()`);
    await waitFor('!!document.querySelector("#screen .tv-slide")');
    await evaluate(`(async () => {
      const { createFramePresenter } = await import('/player/frame-presenter.js');
      const host = document.createElement('div');
      host.innerHTML = '<div id="previous-photo">Foto atual</div>';
      document.body.append(host);
      const original = HTMLImageElement.prototype.decode;
      let release;
      HTMLImageElement.prototype.decode = () => new Promise(resolve => { release = resolve; });
      const presenter = createFramePresenter(host);
      window.frameProbe = { host, presenter, original, release: () => release(), shown: false };
      presenter.show({id:'slow',template:'image',title:'Próxima foto',fields:{media:'/media/abc.png'}}, 'fade', () => { window.frameProbe.shown = true; });
    })()`);
    await delay(900);
    assert.equal(
      await evaluate(
        "!!frameProbe.host.querySelector('#previous-photo') && !frameProbe.shown && !frameProbe.host.querySelector('.frame')",
      ),
      true,
    );
    await evaluate("frameProbe.release()");
    await waitFor(
      "frameProbe.shown && !!frameProbe.host.querySelector('.frame')",
    );
    await evaluate(
      "HTMLImageElement.prototype.decode = frameProbe.original; frameProbe.presenter.cancel(); frameProbe.host.remove(); delete window.frameProbe;",
    );
    assert.equal(await evaluate(`!!document.querySelector('nav')`), false);
    await command("Runtime.evaluate", {
      expression: "document.querySelector('.fullscreen-button').click()",
      userGesture: true,
    });
    await waitFor("!!document.fullscreenElement");
    assert.equal(
      await evaluate("document.querySelector('.fullscreen-button').hidden"),
      true,
    );
    await evaluate("document.exitFullscreen()");
    await waitFor("!document.querySelector('.fullscreen-button').hidden");
    assert.equal(
      await evaluate("location.pathname.startsWith('/watch/')"),
      true,
    );
    await command("Page.navigate", { url: base });
    await waitFor('!!document.querySelector("#channels-logout")');
    await evaluate(`document.querySelector('#channels-logout').click()`);
    await waitFor('!!document.querySelector("#login")');
    await evaluate(
      `document.querySelector('[name=email]').value='browser@test.local';document.querySelector('[name=password]').value='${password}';document.querySelector('#login').requestSubmit()`,
    );
    await waitFor('!!document.querySelector(".stats")');
    await evaluate(
      `document.querySelector('[data-page="Programação"]').click()`,
    );
    await waitFor('!!document.querySelector("[data-action=delete-playlist]")');
    await evaluate(
      `document.querySelector('[data-action=delete-playlist]').click()`,
    );
    await waitFor('document.querySelector("#modal").open');
    await evaluate(`document.querySelector('#dialog-form').requestSubmit()`);
    await waitFor(
      '!document.querySelector("#modal").open && document.querySelector("#playlist-select").textContent.includes("Nova programação")',
    );
    await evaluate(`document.querySelector('[data-page="TVs"]').click()`);
    await waitFor('!!document.querySelector("[data-action=delete-device]")');
    await evaluate(
      `document.querySelector('[data-action=delete-device]').click()`,
    );
    await waitFor('document.querySelector("#modal").open');
    await evaluate(`document.querySelector('#dialog-form').requestSubmit()`);
    await waitFor(
      '!document.querySelector("#modal").open && !document.querySelector("[data-action=delete-device]")',
    );
    await evaluate(`document.querySelector('.logout-button').click()`);
    await waitFor('!!document.querySelector("#login")');
    assert.equal(
      await evaluate(`fetch('/api/me').then(r=>r.status)`),
      401,
      "Sair invalida a sessão no servidor",
    );
    await command("Page.reload");
    await waitFor('!!document.querySelector("#login")');
    assert.deepEqual(errors, [], "sem exceções JavaScript no navegador");
  },
);
