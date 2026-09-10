import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log("O arquivo .env já existe. Nenhuma configuração foi alterada.");
} else {
  const password = randomBytes(18).toString("base64url");
  writeFileSync(
    ".env",
    `PORT=3000\nHOST=127.0.0.1\nPUBLIC_ORIGIN=http://localhost:3000\nCOOKIE_SECURE=false\nGEOTV_ADMIN_EMAIL=admin@geotv.local\nGEOTV_ADMIN_NAME=Administrador\nGEOTV_ADMIN_PASSWORD=${password}\n`,
    { flag: "wx" },
  );
  console.log(
    "Configuração local criada em .env. E-mail: admin@geotv.local. Consulte GEOTV_ADMIN_PASSWORD nesse arquivo para entrar. Execute npm start.",
  );
}
