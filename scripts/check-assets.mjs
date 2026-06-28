import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, 'prototype/3d');
const sourceFiles = [
  'prototype/3d/index.html',
  'prototype/3d/src/main.js',
  'prototype/3d/src/wolf.js',
].map(file => path.join(repoRoot, file)).filter(fs.existsSync);

const dynamicRuntimeAssets = [
  'maps/map15.json',
  'lib/three.module.js',
  'lib/GLTFLoader.js',
  'assets/sounds/bgm.mp3',
  'assets/sounds/swoshes/swosh-03.ogg',
  'textures/texture_road.png',
  'textures/cloud_cumulus.png',
  'textures/texture_foliage.png',
  'assets/vendor/character_gallery/Skeleton_Minion.glb',
  'assets/vendor/kaykit_skeletons/Skeleton_Minion.glb',
  'assets/vendor/quaternius/UAL2_Standard.glb',
  'assets/vendor/skeleton_compare/kaykit_23.glb',
  'assets/vendor/skeleton_compare/quaternius_65.glb',
];

const missing = [];
const external = [];
const checked = new Set();
const referencedGltf = new Set();

function existsRuntime(rel, from = runtimeRoot) {
  const clean = rel.split(/[?#]/)[0];
  if (!clean || clean.startsWith('#') || clean.startsWith('data:') || clean.startsWith('blob:')) return;
  if (clean === 'three' || clean.startsWith('three/')) return;
  if (/^https?:\/\//i.test(clean)) {
    external.push(clean);
    return;
  }
  if (!looksLikeAsset(clean)) return;
  const bases = clean.startsWith('/')
    ? [runtimeRoot]
    : from.endsWith(`${path.sep}src`)
      ? [from, runtimeRoot]
      : [from];
  const candidates = bases
    .map(base => path.resolve(base, clean))
    .filter(target => target === runtimeRoot || target.startsWith(`${runtimeRoot}${path.sep}`));
  if (!candidates.length) return;
  const target = candidates.find(fs.existsSync) || candidates[0];
  const key = path.relative(runtimeRoot, target);
  if (checked.has(key)) return;
  checked.add(key);
  if (!fs.existsSync(target)) {
    missing.push(key);
    return;
  }
  if (target.endsWith('.gltf')) referencedGltf.add(target);
}

function looksLikeAsset(value) {
  return value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('assets/')
    || value.startsWith('textures/')
    || value.startsWith('maps/')
    || value.startsWith('lib/');
}

function checkGltf(file) {
  const dir = path.dirname(file);
  const rel = path.relative(runtimeRoot, file);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse GLTF ${rel}: ${error.message}`);
  }
  for (const buffer of json.buffers || []) if (buffer.uri) existsRuntime(buffer.uri, dir);
  for (const image of json.images || []) if (image.uri) existsRuntime(image.uri, dir);
}

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  for (const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) existsRuntime(match[1], dir);
  for (const match of text.matchAll(/\b(?:load|fetch|import)\(\s*["']([^"']+)["']/g)) existsRuntime(match[1], dir);
  for (const match of text.matchAll(/new URL\(\s*["']([^"']+)["']/g)) existsRuntime(match[1], dir);
  for (const match of text.matchAll(/["']((?:\.{1,2}\/|assets\/|textures\/|maps\/|lib\/)[^"'`]+\.(?:png|jpg|jpeg|gif|mp3|ogg|glb|gltf|bin|json|js|html|txt|ps1|bat))(?:[?#][^"'`]*)?["']/gi)) {
    existsRuntime(match[1], dir);
  }
}

for (const rel of dynamicRuntimeAssets) existsRuntime(rel, runtimeRoot);
for (const file of referencedGltf) checkGltf(file);

if (fs.existsSync(path.join(repoRoot, 'assets/packs/vendor'))) {
  missing.push('assets/packs/vendor should not be tracked in cleaned runtime branch');
}

if (missing.length || external.length) {
  const lines = [];
  if (missing.length) lines.push(`Missing assets:\n${missing.sort().map(item => `- ${item}`).join('\n')}`);
  if (external.length) lines.push(`External runtime references:\n${[...new Set(external)].sort().map(item => `- ${item}`).join('\n')}`);
  throw new Error(lines.join('\n\n'));
}

console.log(`Asset check passed (${checked.size} runtime assets, ${sourceFiles.length} source files).`);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
