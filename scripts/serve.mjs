import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRoot = path.join(projectRoot, "src");
const requestedRoot = process.argv[2] ? path.resolve(projectRoot, process.argv[2]) : defaultRoot;
const serveRoot = requestedRoot.toLowerCase().startsWith(projectRoot.toLowerCase())
  ? requestedRoot
  : defaultRoot;
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
    const filePath = path.resolve(serveRoot, relativePath);

    if (!filePath.toLowerCase().startsWith(serveRoot.toLowerCase())) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch {
      stats = null;
    }

    const fallbackPath = path.join(serveRoot, "index.html");
    const finalPath = stats?.isFile() ? filePath : fallbackPath;
    const content = await fs.readFile(finalPath);
    const contentType = mimeTypes[path.extname(finalPath).toLowerCase()] || "application/octet-stream";

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Preview server error: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI Dataset Now preview: http://127.0.0.1:${port}`);
  console.log(`Serving: ${serveRoot}`);
});

