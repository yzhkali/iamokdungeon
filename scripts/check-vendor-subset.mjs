import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, 'prototype/3d');
const sourceVendorRoot = path.join(repoRoot, 'assets/packs/vendor');
const runtimeVendorRoot = path.join(runtimeRoot, 'assets/vendor');
const missing = [];

if (fs.existsSync(sourceVendorRoot)) {
  missing.push('assets/packs/vendor should not exist on the cleaned runtime branch');
}

if (!fs.existsSync(runtimeVendorRoot)) {
  missing.push('prototype/3d/assets/vendor is missing');
}

for (const file of walk(runtimeVendorRoot).filter(file => file.endsWith('.gltf'))) {
  checkGltf(file);
}

if (missing.length) {
  throw new Error(`Vendor subset check failed:\n${missing.sort().map(item => `- ${item}`).join('\n')}`);
}

console.log(`Vendor subset check passed (${path.relative(repoRoot, runtimeVendorRoot)}).`);

function checkGltf(file) {
  const rel = path.relative(runtimeRoot, file);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    missing.push(`${rel} is not valid JSON: ${error.message}`);
    return;
  }
  const dir = path.dirname(file);
  for (const buffer of json.buffers || []) {
    if (buffer.uri) checkRuntimeDependency(buffer.uri, dir, rel);
  }
  for (const image of json.images || []) {
    if (image.uri) checkRuntimeDependency(image.uri, dir, rel);
  }
}

function checkRuntimeDependency(uri, from, owner) {
  if (!uri || uri.startsWith('data:') || uri.startsWith('blob:')) return;
  if (/^https?:\/\//i.test(uri)) {
    missing.push(`${owner} references external dependency ${uri}`);
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(uri.split(/[?#]/)[0]);
  } catch {
    missing.push(`${owner} has undecodable dependency URI ${uri}`);
    return;
  }
  const target = path.resolve(from, decoded);
  if (target !== runtimeRoot && !target.startsWith(`${runtimeRoot}${path.sep}`)) {
    missing.push(`${owner} references dependency outside runtime root: ${uri}`);
    return;
  }
  if (!fs.existsSync(target)) {
    missing.push(`${owner} missing dependency ${path.relative(runtimeRoot, target)}`);
  }
}

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
