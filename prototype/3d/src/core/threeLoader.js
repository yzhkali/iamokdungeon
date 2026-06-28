const THREE_SOURCE = 'three';
const GLTF_LOADER_SOURCE = 'three/addons/loaders/GLTFLoader.js';

export async function loadThreeRuntime({ loadingEl } = {}) {
  let THREE = null;
  try {
    THREE = await import(THREE_SOURCE);
  } catch {
    THREE = null;
  }

  if (!THREE?.Scene) {
    if (loadingEl) {
      loadingEl.innerHTML = '⚠️ 3D 引擎加载失败<br><span style="font-size:12px">本地 Three.js 依赖加载失败，请确认 lib/three.module.js 存在。</span>';
    }
    throw new Error('Three.js load failed');
  }

  let GLTFLoader = null;
  try {
    const mod = await import(GLTF_LOADER_SOURCE);
    GLTFLoader = mod.GLTFLoader;
  } catch {
    GLTFLoader = null;
  }

  if (!GLTFLoader) console.warn('Local GLTFLoader load failed; vendor models will be skipped.');

  return { THREE, GLTFLoader };
}
