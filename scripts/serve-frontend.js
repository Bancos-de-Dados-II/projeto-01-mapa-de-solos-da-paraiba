import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const port = Number(process.env.FRONTEND_PORT ?? 5173);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const safePath = path
    .normalize(decodeURIComponent(url.pathname))
    .replace(/^(\.\.[/\\])+/, "");
  const requestedPath = path.join(frontendDir, safePath);
  const filePath = await resolveFilePath(requestedPath);

  if (!filePath || !filePath.startsWith(frontendDir)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType(filePath)
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`Frontend listening on http://localhost:${port}`);
});

async function resolveFilePath(requestedPath) {
  const candidate = existsSync(requestedPath) ? requestedPath : path.join(frontendDir, "index.html");
  const fileStat = await stat(candidate).catch(() => null);

  if (!fileStat) {
    return null;
  }

  if (fileStat.isDirectory()) {
    return path.join(candidate, "index.html");
  }

  return candidate;
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    }[ext] ?? "application/octet-stream"
  );
}
