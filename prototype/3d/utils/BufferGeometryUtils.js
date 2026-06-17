import { TrianglesDrawMode, TriangleFanDrawMode, TriangleStripDrawMode } from '../lib/three.module.js';

export function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === TrianglesDrawMode) return geometry;
  if (drawMode !== TriangleFanDrawMode && drawMode !== TriangleStripDrawMode) return geometry;
  let index = geometry.getIndex();
  if (index === null) {
    const pos = geometry.getAttribute('position');
    const indices = [];
    for (let i = 0; i < pos.count; i++) indices.push(i);
    geometry.setIndex(indices);
    index = geometry.getIndex();
  }
  const n = index.count - 2;
  const ni = [];
  if (drawMode === TriangleFanDrawMode) {
    for (let i = 1; i <= n; i++) { ni.push(index.getX(0), index.getX(i), index.getX(i+1)); }
  } else {
    for (let i = 0; i < n; i++) {
      if (i%2===0) ni.push(index.getX(i), index.getX(i+1), index.getX(i+2));
      else         ni.push(index.getX(i+2), index.getX(i+1), index.getX(i));
    }
  }
  const g = geometry.clone();
  g.setIndex(ni);
  g.clearGroups();
  return g;
}
