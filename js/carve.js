// Terrain as rendered in 3D: the stored height map is resampled at a finer
// resolution, then cuttings are dug along open track and the terrain above
// tunnels is kept clear of the vault. Triangles between a cutting and a
// tunnel are dropped so the tunnel mouth is really open (the portal wall
// covers the seam).

import { terrainHeight, VAULT_HEIGHT } from './model.js';

export const RENDER_CELL = 10;       // mm between rendered terrain vertices
const INFLUENCE = 72;                // mm around the track centre line
const CORRIDOR = 36;                 // half width of the track corridor
const CUT_FLAT = 24;                 // flat bottom half width of a cutting

export const CLASS_NONE = 0;
export const CLASS_CUT = 1;
export const CLASS_TUNNEL = 2;

export function carveTerrain(layout, routes, cell = RENDER_CELL) {
  const { w, d } = layout.board;
  const nx = Math.ceil(w / cell) + 1;
  const ny = Math.ceil(d / cell) + 1;
  const N = nx * ny;
  const heights = new Float32Array(N);
  const xs = new Float32Array(nx), ys = new Float32Array(ny);
  for (let i = 0; i < nx; i++) xs[i] = Math.min(i * cell, w);
  for (let j = 0; j < ny; j++) ys[j] = Math.min(j * cell, d);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) heights[j * nx + i] = terrainHeight(layout.terrain, xs[i], ys[j]);
  }

  // nearest track sample for every vertex in the influence zone
  const nearD = new Float32Array(N).fill(Infinity);
  const near = new Array(N);
  for (const r of routes) {
    for (const p of r.pts) {
      const i0 = Math.max(0, Math.floor((p.x - INFLUENCE) / cell));
      const i1 = Math.min(nx - 1, Math.ceil((p.x + INFLUENCE) / cell));
      const j0 = Math.max(0, Math.floor((p.y - INFLUENCE) / cell));
      const j1 = Math.min(ny - 1, Math.ceil((p.y + INFLUENCE) / cell));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * nx + i;
          const dd = Math.hypot(xs[i] - p.x, ys[j] - p.y);
          // prefer the lowest track when two levels overlap
          if (dd < nearD[k] - 0.01 || (Math.abs(dd - nearD[k]) < 4 && near[k] && p.z < near[k].z)) {
            nearD[k] = dd;
            near[k] = p;
          }
        }
      }
    }
  }

  const cls = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const p = near[k];
    if (!p) continue;
    const dd = nearD[k];
    if (dd > INFLUENCE) continue;
    if (p.tunnel) {
      if (dd < CORRIDOR + 4) {
        heights[k] = Math.max(heights[k], p.z + VAULT_HEIGHT + 10);
        cls[k] = CLASS_TUNNEL;
      }
    } else {
      const target = p.z - 0.6 + Math.max(0, dd - CUT_FLAT) * 1.1;
      if (heights[k] > target) heights[k] = target;
      if (dd < CORRIDOR + 4) cls[k] = CLASS_CUT;
    }
  }
  return { nx, ny, cell, xs, ys, heights, cls, nearD };
}

// Triangle index list, skipping triangles that join a cutting to a tunnel.
export function terrainIndices(c) {
  const { nx, ny, cls } = c;
  const idx = [];
  const bad = (a, b, e) => {
    const s = (1 << cls[a]) | (1 << cls[b]) | (1 << cls[e]);
    return (s & (1 << CLASS_CUT)) && (s & (1 << CLASS_TUNNEL));
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, e = a + nx, f = e + 1;
      if (!bad(a, b, e)) idx.push(a, b, e);
      if (!bad(b, f, e)) idx.push(b, f, e);
    }
  }
  return idx;
}
