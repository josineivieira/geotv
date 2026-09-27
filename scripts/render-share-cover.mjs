import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const directory = await mkdtemp(join(tmpdir(), "geotv-cover-"));
try {
  const output = resolve("web/assets/geotv-cover.png");
  await promisify(execFile)(
    process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1200,630",
      `--user-data-dir=${directory}`,
      `--screenshot=${output}`,
      pathToFileURL(resolve("scripts/share-cover.html")).href,
    ],
    { windowsHide: true, timeout: 60000 },
  );
  const image = await readFile(output);
  if (image.readUInt32BE(16) !== 1200 || image.readUInt32BE(20) !== 630)
    throw new Error("Dimensões inesperadas.");
  console.log("Capa gerada: web/assets/geotv-cover.png (1200 × 630).");
} finally {
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
