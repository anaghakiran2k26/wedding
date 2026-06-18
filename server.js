const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ANAGHA@2000";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads", "gallery");
const DATA_DIR = path.join(ROOT, "data");
const GALLERY_FILE = path.join(DATA_DIR, "gallery.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"]
]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readRequestBody(req, limitBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function createToken() {
  const payload = `${Date.now()}.${crypto.randomBytes(18).toString("hex")}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function isValidToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const parts = token.split(".");

  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  const expiresAt = Number(parts[0]) + 1000 * 60 * 60 * 12;
  const expected = Buffer.from(signature);
  const provided = Buffer.from(parts[2]);

  return provided.length === expected.length && crypto.timingSafeEqual(expected, provided) && Date.now() < expiresAt;
}

function safeJoin(baseDir, requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split("?")[0]);
  const normalized = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(baseDir, normalized);
  return fullPath.startsWith(baseDir) ? fullPath : null;
}

function readGallery() {
  if (!fs.existsSync(GALLERY_FILE)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(GALLERY_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeGallery(items) {
  const tmpPath = `${GALLERY_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(items, null, 2));
  fs.renameSync(tmpPath, GALLERY_FILE);
}

function sanitizeFilename(name) {
  const ext = path.extname(name).toLowerCase();
  const stem = path
    .basename(name, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${stem || "wedding-photo"}${ext}`;
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Missing upload boundary.");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let cursor = buffer.indexOf(boundary);

  while (cursor !== -1) {
    cursor += boundary.length;
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;

    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) break;

    const headersRaw = buffer.slice(cursor, headerEnd).toString("utf8");
    let contentStart = headerEnd + 4;
    let nextBoundary = buffer.indexOf(boundary, contentStart);
    if (nextBoundary === -1) break;

    let contentEnd = nextBoundary;
    if (buffer[contentEnd - 2] === 13 && buffer[contentEnd - 1] === 10) {
      contentEnd -= 2;
    }

    const headers = Object.fromEntries(
      headersRaw.split("\r\n").map((line) => {
        const [key, ...value] = line.split(":");
        return [key.toLowerCase(), value.join(":").trim()];
      })
    );

    const disposition = headers["content-disposition"] || "";
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]*)"/);

    parts.push({
      name: nameMatch ? nameMatch[1] : "",
      filename: filenameMatch ? filenameMatch[1] : "",
      contentType: headers["content-type"] || "",
      data: buffer.slice(contentStart, contentEnd)
    });

    cursor = nextBoundary;
  }

  return parts;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const rootDir = requestPath.startsWith("/uploads/") ? ROOT : PUBLIC_DIR;
  const filePath = safeJoin(rootDir, requestPath.startsWith("/uploads/") ? requestPath.slice(1) : requestPath.slice(1));

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/gallery") {
    jsonResponse(res, 200, { photos: readGallery() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    try {
      const body = JSON.parse((await readRequestBody(req, 1024 * 12)).toString("utf8"));
      if (body.password !== ADMIN_PASSWORD) {
        jsonResponse(res, 401, { error: "Invalid password." });
        return;
      }
      jsonResponse(res, 200, { token: createToken() });
    } catch {
      jsonResponse(res, 400, { error: "Could not read login request." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/upload") {
    if (!isValidToken(req)) {
      jsonResponse(res, 401, { error: "Please login again." });
      return;
    }

    try {
      const body = await readRequestBody(req);
      const parts = parseMultipart(body, req.headers["content-type"] || "");
      const title = parts.find((part) => part.name === "title")?.data.toString("utf8").trim() || "Wedding memory";
      const category = parts.find((part) => part.name === "category")?.data.toString("utf8").trim() || "Gallery";
      const files = parts.filter((part) => part.name === "photos" && part.filename && part.data.length > 0);

      if (!files.length) {
        jsonResponse(res, 400, { error: "Choose at least one photo." });
        return;
      }

      const saved = files.map((filePart) => {
        if (!ALLOWED_IMAGE_TYPES.has(filePart.contentType)) {
          throw new Error("Only JPG, PNG, WEBP, and GIF images are allowed.");
        }

        const cleanName = sanitizeFilename(filePart.filename);
        const ext = ALLOWED_IMAGE_TYPES.get(filePart.contentType) || path.extname(cleanName);
        const finalName = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`;
        const finalPath = path.join(UPLOAD_DIR, finalName);

        fs.writeFileSync(finalPath, filePart.data);

        return {
          id: crypto.randomUUID(),
          src: `/uploads/gallery/${finalName}`,
          title,
          category,
          uploadedAt: new Date().toISOString(),
          originalName: cleanName
        };
      });

      const gallery = [...saved, ...readGallery()];
      writeGallery(gallery);
      jsonResponse(res, 201, { photos: saved, gallery });
    } catch (error) {
      jsonResponse(res, 400, { error: error.message || "Upload failed." });
    }
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/gallery/")) {
    if (!isValidToken(req)) {
      jsonResponse(res, 401, { error: "Please login again." });
      return;
    }

    const id = decodeURIComponent(url.pathname.replace("/api/gallery/", ""));
    const gallery = readGallery();
    const photo = gallery.find((item) => item.id === id);

    if (!photo) {
      jsonResponse(res, 404, { error: "Photo not found." });
      return;
    }

    const nextGallery = gallery.filter((item) => item.id !== id);
    writeGallery(nextGallery);

    const fullPath = safeJoin(ROOT, photo.src.replace(/^\//, ""));
    if (fullPath && fullPath.startsWith(UPLOAD_DIR) && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    jsonResponse(res, 200, { gallery: nextGallery });
    return;
  }

  jsonResponse(res, 404, { error: "Unknown API route." });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

function startServer(port = PORT) {
  if (server.listening) return server;

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`Anagha & Kiran wedding site running at http://localhost:${actualPort}`);
    console.log(`Admin page: http://localhost:${actualPort}/admin.html`);
    console.log(`Admin password: ${ADMIN_PASSWORD}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer
};
