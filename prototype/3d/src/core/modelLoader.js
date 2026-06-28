export function createModelLoader({ THREE, GLTFLoader, scene }) {
  const gltfLoader = GLTFLoader ? new GLTFLoader() : null;
  const modelCache = new Map();

  function prepModel(root) {
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          if (Array.isArray(o.material)) {
            o.material.forEach(m => {
              if (m) m.roughness = Math.max(m.roughness ?? 0.8, 0.75);
            });
          } else {
            o.material.roughness = Math.max(o.material.roughness ?? 0.8, 0.75);
          }
        }
      }
    });
  }

  function loadModel(path) {
    if (!gltfLoader) return Promise.resolve(null);
    if (modelCache.has(path)) return modelCache.get(path);
    const p = new Promise(resolve => {
      gltfLoader.load(path, gltf => {
        prepModel(gltf.scene);
        resolve(gltf.scene);
      }, undefined, err => {
        console.warn('Model load failed:', path, err);
        resolve(null);
      });
    });
    modelCache.set(path, p);
    return p;
  }

  function loadFreshModel(path) {
    if (!gltfLoader) return Promise.resolve(null);
    return new Promise(resolve => {
      gltfLoader.load(path, gltf => {
        prepModel(gltf.scene);
        resolve(gltf.scene);
      }, undefined, err => {
        console.warn('Model load failed:', path, err);
        resolve(null);
      });
    });
  }

  async function placeModel(path, x, z, { scale = 1, rot = 0, y = 0, parent = scene, name = '', groundCenter = false } = {}) {
    const src = await loadModel(path);
    if (!src) return null;
    const obj = src.clone(true);
    obj.rotation.y = rot;
    obj.scale.setScalar(scale);
    if (groundCenter) {
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      obj.position.set(x - c.x, y - box.min.y, z - c.z);
    } else {
      obj.position.set(x, y, z);
    }
    if (name) obj.name = name;
    parent.add(obj);
    return obj;
  }

  return { loadModel, loadFreshModel, placeModel };
}
