/**
 * server.js — ТВОЁ БЕЛЬЁ Catalog Admin Server
 * Zero external dependencies — uses only Node.js built-ins.
 * Run: node server.js
 * Then open: http://localhost:5500
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT    = 5500;
const ROOT    = __dirname;
const DATA    = path.join(ROOT, 'data.json');
const IMAGES  = path.join(ROOT, 'images');

/* ── MIME types ─────────────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

/* ── Helpers ─────────────────────────────────────────────────────────── */
function mime(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function json(res, status, obj) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ── Multipart parser (images upload) ───────────────────────────────── */
function parseMultipart(buffer, boundary) {
  const sep    = Buffer.from('--' + boundary);
  const parts  = [];
  let   start  = 0;

  while (start < buffer.length) {
    const sepIdx = buffer.indexOf(sep, start);
    if (sepIdx === -1) break;
    const afterSep = sepIdx + sep.length;
    if (buffer[afterSep] === 45 && buffer[afterSep + 1] === 45) break; // '--'
    const bodyStart = buffer.indexOf('\r\n\r\n', afterSep);
    if (bodyStart === -1) break;
    const headerBuf = buffer.slice(afterSep + 2, bodyStart).toString();
    const nextSep   = buffer.indexOf(sep, bodyStart + 4);
    const bodyEnd   = nextSep === -1 ? buffer.length : nextSep - 2;
    const body      = buffer.slice(bodyStart + 4, bodyEnd);

    const nameMatch     = headerBuf.match(/name="([^"]+)"/);
    const filenameMatch = headerBuf.match(/filename="([^"]+)"/);
    parts.push({
      name:     nameMatch     ? nameMatch[1]     : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      data:     body,
    });
    start = nextSep;
  }
  return parts;
}

/* ── Serve static file ───────────────────────────────────────────────── */
function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'text/plain', 'Not found');
      return;
    }
    send(res, 200, mime(filePath), data);
  });
}

/* ── Request router ──────────────────────────────────────────────────── */
const server = http.createServer((req, res) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();

  /* CORS preflight */
  if (method === 'OPTIONS') { send(res, 204, 'text/plain', ''); return; }

  /* ── GET /data.json ── */
  if (method === 'GET' && url.pathname === '/data.json') {
    serveFile(res, DATA);
    return;
  }

  /* ── POST /api/save-data ── */
  if (method === 'POST' && url.pathname === '/api/save-data') {
    readBody(req).then(buf => {
      try {
        const parsed = JSON.parse(buf.toString()); // validate JSON
        fs.writeFile(DATA, JSON.stringify(parsed, null, 2), 'utf8', err => {
          if (err) { json(res, 500, { ok: false, error: err.message }); return; }
          json(res, 200, { ok: true });
        });
      } catch (e) {
        json(res, 400, { ok: false, error: 'Invalid JSON' });
      }
    }).catch(e => json(res, 500, { ok: false, error: e.message }));
    return;
  }

  /* ── POST /api/upload-image ── */
  if (method === 'POST' && url.pathname === '/api/upload-image') {
    const ct = req.headers['content-type'] || '';
    const bMatch = ct.match(/boundary=([^\s;]+)/);
    if (!bMatch) { json(res, 400, { ok: false, error: 'No boundary' }); return; }

    readBody(req).then(buf => {
      const parts = parseMultipart(buf, bMatch[1]);
      const file  = parts.find(p => p.filename);
      if (!file) { json(res, 400, { ok: false, error: 'No file' }); return; }

      // Sanitise filename & make unique
      const ext      = path.extname(file.filename).toLowerCase() || '.jpg';
      const base     = 'product_' + Date.now();
      const filename = base + ext;
      const dest     = path.join(IMAGES, filename);

      if (!fs.existsSync(IMAGES)) fs.mkdirSync(IMAGES, { recursive: true });

      fs.writeFile(dest, file.data, err => {
        if (err) { json(res, 500, { ok: false, error: err.message }); return; }
        json(res, 200, { ok: true, path: 'images/' + filename });
      });
    }).catch(e => json(res, 500, { ok: false, error: e.message }));
    return;
  }

  /* ── DELETE /api/delete-image?file=images/xxx.jpg ── */
  if (method === 'DELETE' && url.pathname === '/api/delete-image') {
    const file = url.searchParams.get('file');
    if (!file) { json(res, 400, { ok: false, error: 'No file param' }); return; }

    // Security: only allow deleting from images/ subdir
    const abs = path.resolve(ROOT, file);
    if (!abs.startsWith(path.resolve(IMAGES))) {
      json(res, 403, { ok: false, error: 'Forbidden' });
      return;
    }
    fs.unlink(abs, err => {
      if (err && err.code !== 'ENOENT') {
        json(res, 500, { ok: false, error: err.message }); return;
      }
      json(res, 200, { ok: true });
    });
    return;
  }

  /* ── Static files ── */
  let filePath = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) { send(res, 403, 'text/plain', 'Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    serveFile(res, filePath);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ✨ ТВОЁ БЕЛЬЁ — Admin Server\n`);
  console.log(`  Каталог:  http://localhost:${PORT}/`);
  console.log(`  Админка:  http://localhost:${PORT}/admin.html`);
  console.log(`\n  Нажмите Ctrl+C для остановки.\n`);
});
