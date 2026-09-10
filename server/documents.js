import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { storage, audit } from "./db.js";
import { fail } from "./security.js";
const execute = promisify(execFile);
const converter = () =>
  process.env.LIBREOFFICE_PATH ||
  [
    "C:/Program Files/LibreOffice/program/soffice.exe",
    "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
  ].find(existsSync);
export const documentCapabilities = () => ({
  pdf: true,
  powerpoint: !!converter(),
  maxPages: 60,
  maxMegabytes: 40,
});
let busy = false;
export async function convertPowerPoint(req, res, user, readBody) {
  const executable = converter();
  if (!executable)
    fail(
      503,
      "Conversor PowerPoint indisponível. Instale LibreOffice no servidor ou exporte o arquivo como PDF.",
    );
  if (busy)
    fail(
      429,
      "Outra apresentação está sendo convertida. Aguarde e tente novamente.",
    );
  const name = decodeURIComponent(req.headers["x-file-name"] || "");
  const ext = name.split(".").pop()?.toLowerCase();
  const mime = {
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  }[ext];
  if (!mime || req.headers["content-type"] !== mime || name.length > 200)
    fail(400, "Envie um arquivo .ppt ou .pptx válido.");
  busy = true;
  let directory;
  try {
    const bytes = await readBody(req, 40 * 1024 * 1024, true);
    const valid =
      ext === "pptx"
        ? bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
        : bytes
            .subarray(0, 8)
            .equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]));
    if (!valid)
      fail(400, "O arquivo não corresponde a uma apresentação PowerPoint.");
    directory = await mkdtemp(join(storage, "conversion-"));
    const profile = join(directory, "profile");
    await mkdir(join(profile, "user"), { recursive: true });
    await writeFile(
      join(profile, "user", "registrymodifications.xcu"),
      '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateLinks" oor:op="fuse"><value>0</value></prop></item></oor:items>',
    );
    const input = join(directory, "presentation." + ext);
    await writeFile(input, bytes);
    try {
      await execute(
        executable,
        [
          `-env:UserInstallation=${pathToFileURL(profile).href}`,
          "--headless",
          "--nologo",
          "--nodefault",
          "--norestore",
          "--convert-to",
          "pdf:impress_pdf_Export",
          "--outdir",
          directory,
          input,
        ],
        { timeout: 90000, windowsHide: true, maxBuffer: 1024 * 1024 },
      );
    } catch {
      fail(
        422,
        "Não foi possível converter o PowerPoint. Verifique se está íntegro e sem senha, ou exporte como PDF.",
      );
    }
    const pdf = await readFile(join(directory, "presentation.pdf")).catch(
      () => null,
    );
    if (
      !pdf ||
      pdf.length > 80 * 1024 * 1024 ||
      pdf.toString("ascii", 0, 5) !== "%PDF-"
    )
      fail(422, "A conversão não produziu um PDF válido dentro do limite.");
    await audit(user, "Importou PowerPoint", null, null, {
      name,
      size: bytes.length,
    });
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  } finally {
    busy = false;
    if (directory) {
      const target = resolve(directory);
      if (
        target.startsWith(resolve(storage) + sep) &&
        target.split(sep).pop().startsWith("conversion-")
      )
        await rm(target, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 300,
        }).catch((error) =>
          console.error(
            "Não foi possível limpar conversão temporária:",
            error.code,
          ),
        );
    }
  }
}
