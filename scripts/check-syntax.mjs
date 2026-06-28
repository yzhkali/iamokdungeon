import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const files = [
  ...walk(path.join(repoRoot, 'prototype/3d/src')).filter(file => file.endsWith('.js')),
  ...walk(path.join(repoRoot, 'scripts')).filter(file => file.endsWith('.mjs')),
];
const htmlFiles = [
  'prototype/3d/index.html',
  'prototype/3d/editor3d.html',
  'prototype/3d/gallery.html',
  'prototype/3d/pose-editor.html',
  'prototype/3d/sfx-editor.html',
  'prototype/3d/bones.html',
  'prototype/3d/skeleton-demo.html',
  'prototype/3d/quat-demo.html',
].map(file => path.join(repoRoot, file)).filter(fs.existsSync);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function checkNode(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Syntax check failed for ${path.relative(repoRoot, file)}\n${result.stderr || result.stdout}`);
  }
}

let inlineCount = 0;
for (const file of files) checkNode(file);
for (const html of htmlFiles) {
  const text = fs.readFileSync(html, 'utf8');
  const scripts = [...text.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (let index = 0; index < scripts.length; index += 1) {
    const attrs = scripts[index][1] || '';
    if (/\btype\s*=\s*["'](?:importmap|application\/json)["']/i.test(attrs)) continue;
    const code = scripts[index][2].trim();
    if (!code) continue;
    const tmp = path.join(repoRoot, `.syntax-inline-${process.pid}-${inlineCount++}.mjs`);
    fs.writeFileSync(tmp, code);
    try {
      checkNode(tmp);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}

console.log(`Syntax check passed (${files.length} files plus ${inlineCount} inline scripts).`);
