import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const distDir = path.join(rootDir, "dist");
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(frontendDir, distDir, { recursive: true });
await writeFile(
  path.join(distDir, "config.js"),
  `window.APP_CONFIG = ${JSON.stringify({ API_BASE_URL: apiBaseUrl }, null, 2)};\n`
);

console.log(`Frontend build concluido em ${distDir}`);
