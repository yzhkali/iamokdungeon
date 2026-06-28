import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.bin', 'application/octet-stream'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function safePath(root, requestUrl) {
  let url;
  try {
    url = new URL(requestUrl, 'http://127.0.0.1');
  } catch {
    return null;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.split('/').includes('..')) return null;
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(root, rel);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

export function createStaticServer({ root = 'prototype/3d' } = {}) {
  const absoluteRoot = path.resolve(process.cwd(), root);
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });
      return;
    }
    const target = safePath(absoluteRoot, req.url || '/');
    if (!target) {
      send(res, 403, 'Forbidden');
      return;
    }
    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      send(res, 404, 'Not Found');
      return;
    }
    if (stat.isDirectory()) {
      send(res, 403, 'Directory listing disabled');
      return;
    }
    const type = MIME.get(path.extname(target).toLowerCase()) || 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(target).pipe(res);
  });
}

function listen(server, port) {
  return new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || 'prototype/3d';
  const port = Number(process.argv[3] || 4173);
  const server = createStaticServer({ root });
  await listen(server, port);
  console.log(`Serving ${path.resolve(root)} at http://127.0.0.1:${port}/`);
}
