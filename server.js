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

  /* ── GET /api/moysklad-token ── */
  if (method === 'GET' && url.pathname === '/api/moysklad-token') {
    try {
      const cfgPath = path.join(ROOT, 'moysklad-config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        json(res, 200, { ok: true, token: cfg.token || '' });
      } else {
        json(res, 200, { ok: true, token: '' });
      }
    } catch(e) {
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  /* ── POST /api/moysklad-sync ── */
  if (method === 'POST' && url.pathname === '/api/moysklad-sync') {
    readBody(req).then(async buf => {
      try {
        const { token } = JSON.parse(buf.toString());
        if (!token) return json(res, 400, { ok: false, error: 'Token is required' });

        // Save token to config
        fs.writeFileSync(path.join(ROOT, 'moysklad-config.json'), JSON.stringify({ token }));

        // Fetch from MoySklad with pagination
        let allRows = [];
        let offset = 0;
        const limit = 1000;
        
        while (true) {
          const msRes = await fetch(`https://api.moysklad.ru/api/remap/1.2/entity/assortment?limit=${limit}&offset=${offset}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!msRes.ok) {
            const errText = await msRes.text();
            throw new Error(`Moysklad API Error: ${msRes.status} ${errText}`);
          }

          const msData = await msRes.json();
          const rows = msData.rows || [];
          allRows = allRows.concat(rows);
          
          if (rows.length < limit) break;
          offset += limit;
        }

        const msProducts = {}; // id -> product

        // First pass: collect products
        for (const row of allRows) {
          if (row.meta.type === 'product') {
            msProducts[row.id] = {
              name: row.name,
              price: row.salePrices && row.salePrices[0] ? row.salePrices[0].value / 100 : null,
              pathName: row.pathName || '',
              sizes: new Set(),
              colors: new Set()
            };
          }
        }

        // Second pass: collect variants
        for (const row of allRows) {
          if (row.meta.type === 'variant' && row.product && row.product.meta) {
            const parentUrl = row.product.meta.href;
            const parentId = parentUrl.substring(parentUrl.lastIndexOf('/') + 1);
            
            const parent = msProducts[parentId];
            if (parent) {
              if (row.salePrices && row.salePrices[0]) {
                parent.price = row.salePrices[0].value / 100;
              }
              if (row.characteristics) {
                row.characteristics.forEach(c => {
                  const name = c.name.toLowerCase();
                  if (name === 'размер') {
                    let val = c.value.trim().toUpperCase().replace(/-0$/, '');
                    const match = val.match(/^(\d{2,3})[\s\-\/]*([A-Z]+)$/);
                    if (match) val = match[1] + match[2];
                    parent.sizes.add(val);
                  }
                  if (name === 'цвет') parent.colors.add(c.value);
                });
              }
            }
          }
        }

        // Read local data.json
        const localDataBuf = fs.readFileSync(DATA, 'utf8');
        const catalog = JSON.parse(localDataBuf);
        catalog.products = catalog.products || [];
        
        let updated = 0;
        let added = 0;

        for (const msId in msProducts) {
          const msp = msProducts[msId];
          const mKey = msp.name.trim().toLowerCase();
          
          // 1. Try match by moysklad_id
          let p = catalog.products.find(x => x.moysklad_id === msId);
          
          // 2. Try exact name match
          if (!p) p = catalog.products.find(x => x.name.trim().toLowerCase() === mKey);
          
          // 3. Try fuzzy name match (substring)
          if (!p) {
            const sortedLocals = catalog.products.slice().sort((a,b) => b.name.length - a.name.length);
            for (const loc of sortedLocals) {
              const locKey = loc.name.trim().toLowerCase();
              if (locKey.length > 5 && (mKey.includes(locKey) || locKey.includes(mKey))) {
                p = loc;
                break;
              }
            }
          }

          const sizeArr = Array.from(msp.sizes).sort();
          const colorStr = Array.from(msp.colors).join(', ');

          if (p) {
            // Update existing
            p.moysklad_id = msId;
            p.price = msp.price !== null ? msp.price : p.price;
            p.available_sizes = sizeArr.length > 0 ? sizeArr : p.available_sizes;
            p.color = colorStr || p.color;
            updated++;
          } else {
            // Add new
            let cat = 'Все';
            const pn = msp.pathName.toLowerCase();
            if (pn.includes('белье')) cat = 'Бюстгальтеры';
            if (pn.includes('колготки')) cat = 'Колготки';
            if (pn.includes('трусики')) cat = 'Трусики';
            if (pn.includes('боди')) cat = 'Боди';
            
            const maxId = catalog.products.reduce((m, x) => Math.max(m, x.id || 0), 0);
            p = {
              id: maxId + 1,
              moysklad_id: msId,
              name: msp.name,
              category: cat,
              price: msp.price,
              featured: false
            };
            if (sizeArr.length > 0) p.available_sizes = sizeArr;
            if (colorStr) p.color = colorStr;
            
            catalog.products.push(p);
            added++;
          }
        }

        fs.writeFileSync(DATA, JSON.stringify(catalog, null, 2), 'utf8');

        json(res, 200, { ok: true, added, updated });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
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

  /* ── POST /api/deploy ── */
  if (method === 'POST' && url.pathname === '/api/deploy') {
    const { exec } = require('child_process');
    exec('git add . && git commit -m "Авто-обновление из админки" && git push', { cwd: ROOT }, (error, stdout, stderr) => {
      // If error is just "nothing to commit", it's fine.
      if (error && !stdout.includes('nothing to commit')) {
        json(res, 500, { ok: false, error: stderr || error.message });
        return;
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
