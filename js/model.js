// Layout data model: baseboard, track pieces, terrain, scenery and trains.
// The layout is a plain JSON-friendly object; derived data (connections)
// is cached and recomputed when `layout.rev` changes.

import { pieceGeometry } from './catalog/tracks.js';
import { toWorld, normAngle, angleDiff, lerp, clamp } from './geom.js';

export const FORMAT_VERSION = 1;
export const TERRAIN_CELL = 20; // mm between terrain grid vertices
export const WATER_LEVEL = -8;  // mm; terrain below this is under water

export const PAINTS = [
  { id: 'grass', color: [96, 140, 70] },
  { id: 'meadow', color: [138, 170, 86] },
  { id: 'soil', color: [128, 98, 66] },
  { id: 'rock', color: [140, 136, 128] },
  { id: 'sand', color: [205, 186, 140] },
  { id: 'snow', color: [236, 240, 244] },
];

export function createLayout({ width = 2400, depth = 1200, name = '' } = {}) {
  const layout = {
    version: FORMAT_VERSION,
    name,
    board: { w: width, d: depth },
    pieces: [],
    scenery: [],
    trains: [],
    terrain: null,
    nextId: 1,
    rev: 0,
  };
  layout.terrain = createTerrain(width, depth);
  return layout;
}

export function newId(layout) {
  return layout.nextId++;
}

export function touch(layout) {
  layout.rev++;
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

export function createTerrain(w, d, cell = TERRAIN_CELL) {
  const nx = Math.ceil(w / cell) + 1;
  const ny = Math.ceil(d / cell) + 1;
  return {
    cell, nx, ny,
    heights: new Float32Array(nx * ny),
    paint: new Uint8Array(nx * ny),
  };
}

// Resize the baseboard keeping the existing terrain where it overlaps.
export function resizeBoard(layout, w, d) {
  const old = layout.terrain;
  const t = createTerrain(w, d, old.cell);
  for (let j = 0; j < Math.min(old.ny, t.ny); j++) {
    for (let i = 0; i < Math.min(old.nx, t.nx); i++) {
      t.heights[j * t.nx + i] = old.heights[j * old.nx + i];
      t.paint[j * t.nx + i] = old.paint[j * old.nx + i];
    }
  }
  layout.board = { w, d };
  layout.terrain = t;
  touch(layout);
}

export function terrainHeight(terrain, x, y) {
  const { cell, nx, ny, heights } = terrain;
  const fx = clamp(x / cell, 0, nx - 1.0001);
  const fy = clamp(y / cell, 0, ny - 1.0001);
  const i = Math.floor(fx), j = Math.floor(fy);
  const tx = fx - i, ty = fy - j;
  const h00 = heights[j * nx + i], h10 = heights[j * nx + i + 1];
  const h01 = heights[(j + 1) * nx + i], h11 = heights[(j + 1) * nx + i + 1];
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), ty);
}

// Apply a circular brush. mode: raise | lower | smooth | flatten | paint
export function applyBrush(terrain, cx, cy, opts) {
  const { radius, strength = 1, mode, target = 0, paint = 0 } = opts;
  const { cell, nx, ny, heights } = terrain;
  const i0 = Math.max(0, Math.floor((cx - radius) / cell));
  const i1 = Math.min(nx - 1, Math.ceil((cx + radius) / cell));
  const j0 = Math.max(0, Math.floor((cy - radius) / cell));
  const j1 = Math.min(ny - 1, Math.ceil((cy + radius) / cell));
  const src = mode === 'smooth' ? heights.slice() : heights;
  let changed = false;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const dx = i * cell - cx, dy = j * cell - cy;
      const r = Math.hypot(dx, dy);
      if (r > radius) continue;
      const f = 0.5 + 0.5 * Math.cos((Math.PI * r) / radius); // smooth falloff
      const k = j * nx + i;
      switch (mode) {
        case 'raise': heights[k] = clamp(heights[k] + strength * f, -150, 600); break;
        case 'lower': heights[k] = clamp(heights[k] - strength * f, -150, 600); break;
        case 'flatten': heights[k] = lerp(heights[k], target, Math.min(1, 0.35 * strength * f)); break;
        case 'smooth': {
          let s = 0, n = 0;
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
            const ii = i + a, jj = j + b;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
            s += src[jj * nx + ii]; n++;
          }
          heights[k] = lerp(src[k], s / n, Math.min(1, 0.5 * strength * f));
          break;
        }
        case 'paint': if (f > 0.25) terrain.paint[k] = paint; break;
      }
      changed = true;
    }
  }
  return changed;
}

// Raise the terrain under tracks that run above it (embankments).
export function buildEmbankments(layout) {
  const t = layout.terrain;
  const { cell, nx, ny, heights } = t;
  const inner = 24, outer = 70;
  const target = new Float32Array(nx * ny).fill(-Infinity);
  for (const p of layout.pieces) {
    const g = pieceGeometry(p);
    if (!g) continue;
    for (const r of g.routes) {
      const n = Math.max(2, Math.ceil(r.len / 10));
      for (let s = 0; s <= n; s++) {
        const pose = routePose(p, g, r, (r.len * s) / n);
        const z = pose.z - 1;
        const i0 = Math.max(0, Math.floor((pose.x - outer) / cell));
        const i1 = Math.min(nx - 1, Math.ceil((pose.x + outer) / cell));
        const j0 = Math.max(0, Math.floor((pose.y - outer) / cell));
        const j1 = Math.min(ny - 1, Math.ceil((pose.y + outer) / cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const dd = Math.hypot(i * cell - pose.x, j * cell - pose.y);
          if (dd > outer) continue;
          const zz = dd <= inner ? z : z - (dd - inner) * 0.9; // ~42° slope
          const k = j * nx + i;
          if (zz > target[k]) target[k] = zz;
        }
      }
    }
  }
  let changed = false;
  for (let k = 0; k < heights.length; k++) {
    if (target[k] > heights[k]) { heights[k] = target[k]; changed = true; }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Track pieces
// ---------------------------------------------------------------------------

export function createPiece(layout, ref, x, y, rot, extra = {}) {
  const piece = { id: newId(layout), ref, x, y, rot: normAngle(rot), state: 0, ...extra };
  const g = pieceGeometry(piece);
  if (!piece.h) piece.h = g.endpoints.map(() => 0);
  return piece;
}

// Transform that puts local endpoint `ep` of a piece onto a world endpoint
// target {x, y, a} (facing it).
export function transformToEndpoint(piece, ep, target) {
  const g = pieceGeometry(piece);
  const e = g.endpoints[ep];
  const rot = normAngle(target.a + Math.PI - e.a);
  const c = Math.cos(rot), s = Math.sin(rot);
  return { x: target.x - (e.x * c - e.y * s), y: target.y - (e.x * s + e.y * c), rot };
}

// Create a piece connected by its endpoint `ep` to world endpoint `target`.
// The new piece inherits the target height on all its endpoints.
export function createAttached(layout, ref, ep, target, extra = {}) {
  const piece = createPiece(layout, ref, 0, 0, 0, extra);
  Object.assign(piece, transformToEndpoint(piece, ep, target));
  piece.h = piece.h.map(() => target.z || 0);
  return piece;
}

export function findPiece(layout, id) {
  if (layout._idxRev !== layout.rev || !layout._idx) {
    layout._idx = new Map(layout.pieces.map((p) => [p.id, p]));
    layout._idxRev = layout.rev;
  }
  return layout._idx.get(id) || layout.pieces.find((p) => p.id === id);
}

// World-space endpoints of a piece: [{x, y, a, z, buffer}]
export function worldEndpoints(piece) {
  const g = pieceGeometry(piece);
  return g.endpoints.map((e, i) => {
    const w = toWorld(piece, e);
    return { x: w.x, y: w.y, a: normAngle(e.a + piece.rot), z: piece.h?.[i] ?? 0, buffer: !!e.buffer, i };
  });
}

// Pose along a route at distance s from the route's `from` endpoint,
// in world coordinates. z interpolates the endpoint heights.
export function routePose(piece, g, route, s) {
  s = clamp(s, 0, route.len);
  // local pose along the route
  let p = { ...route.start };
  let rem = s;
  for (let i = 0; i < route.segs.length; i++) {
    const seg = route.segs[i];
    const L = seg.type === 'line' ? seg.len : Math.abs(seg.angle) * seg.r;
    const d = i === route.segs.length - 1 ? rem : Math.min(rem, L);
    p = advance(p, seg, d);
    rem -= d;
    if (rem <= 0) break;
  }
  const w = toWorld(piece, p);
  const h0 = piece.h?.[route.from] ?? 0, h1 = piece.h?.[route.to] ?? 0;
  const t = route.len ? s / route.len : 0;
  return { x: w.x, y: w.y, a: normAngle(p.a + piece.rot), z: lerp(h0, h1, t), grade: route.len ? (h1 - h0) / route.len : 0 };
}

function advance(p, seg, d) {
  if (seg.type === 'line') return { x: p.x + Math.cos(p.a) * d, y: p.y + Math.sin(p.a) * d, a: p.a };
  const sign = Math.sign(seg.angle);
  const cx = p.x - Math.sin(p.a) * seg.r * sign;
  const cy = p.y + Math.cos(p.a) * seg.r * sign;
  const a2 = p.a + (d / seg.r) * sign;
  return { x: cx + Math.sin(a2) * seg.r * sign, y: cy - Math.cos(a2) * seg.r * sign, a: a2 };
}

export const SNAP_DIST = 2.5;             // mm
export const SNAP_ANGLE = 2.5 * Math.PI / 180;

// Build the connection map: "pieceId:endpoint" -> {pid, ep}
export function connections(layout) {
  if (layout._conn && layout._connRev === layout.rev) return layout._conn;
  const map = new Map();
  const grid = new Map();
  const cellKey = (x, y) => `${Math.round(x / 10)},${Math.round(y / 10)}`;
  const all = [];
  for (const p of layout.pieces) {
    if (!pieceGeometry(p)) continue;
    for (const e of worldEndpoints(p)) {
      if (e.buffer) continue;
      const item = { pid: p.id, ep: e.i, x: e.x, y: e.y, a: e.a };
      all.push(item);
      const k = cellKey(e.x, e.y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(item);
    }
  }
  for (const it of all) {
    if (map.has(`${it.pid}:${it.ep}`)) continue;
    const cx = Math.round(it.x / 10), cy = Math.round(it.y / 10);
    let best = null, bestD = SNAP_DIST;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const o of grid.get(`${cx + dx},${cy + dy}`) || []) {
        if (o.pid === it.pid) continue;
        if (map.has(`${o.pid}:${o.ep}`)) continue;
        const d = Math.hypot(o.x - it.x, o.y - it.y);
        if (d < bestD && angleDiff(o.a, it.a + Math.PI) < SNAP_ANGLE) { best = o; bestD = d; }
      }
    }
    if (best) {
      map.set(`${it.pid}:${it.ep}`, { pid: best.pid, ep: best.ep });
      map.set(`${best.pid}:${best.ep}`, { pid: it.pid, ep: it.ep });
    }
  }
  layout._conn = map;
  layout._connRev = layout.rev;
  return map;
}

// Open (unconnected, non-buffer) endpoints in world space.
export function openEndpoints(layout) {
  const conn = connections(layout);
  const out = [];
  for (const p of layout.pieces) {
    if (!pieceGeometry(p)) continue;
    for (const e of worldEndpoints(p)) {
      if (e.buffer || conn.has(`${p.id}:${e.i}`)) continue;
      out.push({ pid: p.id, ...e });
    }
  }
  return out;
}

// Set the height of an endpoint and propagate to the connected endpoint.
export function setEndpointHeight(layout, piece, ep, z) {
  piece.h[ep] = z;
  const other = connections(layout).get(`${piece.id}:${ep}`);
  if (other) {
    const op = findPiece(layout, other.pid);
    if (op) op.h[other.ep] = z;
  }
}

// Bill of materials: [{ref, count}]
export function billOfMaterials(layout) {
  const counts = new Map();
  for (const p of layout.pieces) counts.set(p.ref, (counts.get(p.ref) || 0) + 1);
  return [...counts.entries()].map(([ref, count]) => ({ ref, count })).sort((a, b) => a.ref.localeCompare(b.ref));
}

export function totalTrackLength(layout) {
  let L = 0;
  for (const p of layout.pieces) {
    const g = pieceGeometry(p);
    if (g) L += g.routes[0].len;
  }
  return L;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function serialize(layout) {
  const t = layout.terrain;
  const q = new Int16Array(t.heights.length);
  for (let i = 0; i < q.length; i++) q[i] = Math.round(t.heights[i] * 4);
  return {
    format: 'ho-railway-layout',
    version: FORMAT_VERSION,
    name: layout.name,
    board: { ...layout.board },
    pieces: layout.pieces.map((p) => ({ ...p, x: +p.x.toFixed(3), y: +p.y.toFixed(3), rot: +p.rot.toFixed(6) })),
    scenery: layout.scenery.map((s) => ({ ...s })),
    trains: layout.trains.map((tr) => ({
      id: tr.id, name: tr.name, consist: [...tr.consist],
      head: { ...tr.head }, trail: tr.trail.map((e) => ({ ...e })), reversed: !!tr.reversed,
      shuttle: !!tr.shuttle,
    })),
    terrain: {
      cell: t.cell, nx: t.nx, ny: t.ny,
      heights: toB64(new Uint8Array(q.buffer)),
      paint: toB64(t.paint),
    },
    nextId: layout.nextId,
  };
}

export function deserialize(data) {
  if (!data || data.format !== 'ho-railway-layout') throw new Error('Not a layout file');
  const layout = createLayout({ width: data.board.w, depth: data.board.d, name: data.name || '' });
  layout.pieces = (data.pieces || []).filter((p) => pieceGeometry(p)).map((p) => {
    const g = pieceGeometry(p);
    const h = Array.isArray(p.h) && p.h.length === g.endpoints.length ? p.h : g.endpoints.map(() => 0);
    return { ...p, h, state: p.state || 0 };
  });
  layout.scenery = (data.scenery || []).map((s) => ({ ...s }));
  layout.trains = (data.trains || []).map((tr) => ({
    ...tr, speed: 0, throttle: 0, trail: tr.trail || [], reversed: !!tr.reversed,
  }));
  if (data.terrain && data.terrain.nx === layout.terrain.nx && data.terrain.ny === layout.terrain.ny) {
    const hb = fromB64(data.terrain.heights);
    const q = new Int16Array(hb.buffer, hb.byteOffset, hb.byteLength / 2);
    for (let i = 0; i < q.length && i < layout.terrain.heights.length; i++) layout.terrain.heights[i] = q[i] / 4;
    const pb = fromB64(data.terrain.paint);
    layout.terrain.paint.set(pb.subarray(0, layout.terrain.paint.length));
  }
  let maxId = 0;
  for (const p of layout.pieces) maxId = Math.max(maxId, p.id);
  for (const s of layout.scenery) maxId = Math.max(maxId, s.id);
  for (const t of layout.trains) maxId = Math.max(maxId, t.id);
  layout.nextId = Math.max(data.nextId || 1, maxId + 1);
  return layout;
}
