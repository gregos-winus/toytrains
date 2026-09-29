// Editing operations shared by the plan view, the 3D view and the panels.

import { pieceGeometry, isSwitchable } from './catalog/tracks.js';
import { stock } from './catalog/rolling-stock.js';
import { sceneryType } from './catalog/scenery.js';
import {
  createAttached, createPiece, worldEndpoints, findPiece, connections, touch, newId,
  transformToEndpoint, openEndpoints,
} from './model.js';
import { placeTrain } from './sim.js';
import { normAngle, angleDiff, rotate, DEG } from './geom.js';
import { t, tr } from './i18n.js';

// Pick the endpoint to continue from after attaching piece by `ep`.
function continuationEndpoint(piece, ep) {
  const g = pieceGeometry(piece);
  const active = g.states[piece.state || 0] || g.states[0];
  const routes = g.routes.filter((r) => r.from === ep || r.to === ep);
  const r = routes.find((x) => active.includes(x.idx)) || routes[0];
  if (r) {
    const other = r.from === ep ? r.to : r.from;
    if (!g.endpoints[other].buffer) return other;
  }
  const idx = g.endpoints.findIndex((e, i) => i !== ep && !e.buffer);
  return idx >= 0 ? idx : null;
}

function anchorTarget(app) {
  if (!app.anchor) return null;
  const p = findPiece(app.layout, app.anchor.pid);
  if (!p) return null;
  return worldEndpoints(p)[app.anchor.ep];
}

// Add a catalogue piece to the active chaining anchor.
export function chainAdd(app, ref) {
  const target = anchorTarget(app);
  if (!target) return false;
  const tmp = { ref };
  const g = pieceGeometry(tmp);
  const n = g.endpoints.length;
  let ep = app.attachEp % n;
  if (g.endpoints[ep].buffer) ep = g.endpoints.findIndex((e) => !e.buffer);
  const piece = createAttached(app.layout, ref, ep, target, g.variable ? { len: g.variable.def } : {});
  app.layout.pieces.push(piece);
  touch(app.layout);
  app.lastChained = { pid: piece.id, anchor: { ...app.anchor }, ref, ep };
  const next = continuationEndpoint(piece, ep);
  app.anchor = next != null ? { pid: piece.id, ep: next } : null;
  app.select([`p:${piece.id}`]);
  app.commit();
  return true;
}

// Cycle the connecting endpoint of the last chained piece.
export function flipLast(app) {
  const lc = app.lastChained;
  if (!lc) return false;
  const piece = findPiece(app.layout, lc.pid);
  if (!piece) return false;
  const g = pieceGeometry(piece);
  let ep = lc.ep;
  for (let k = 0; k < g.endpoints.length; k++) {
    ep = (ep + 1) % g.endpoints.length;
    if (!g.endpoints[ep].buffer) break;
  }
  app.layout.pieces = app.layout.pieces.filter((p) => p !== piece);
  touch(app.layout);
  app.anchor = lc.anchor;
  app.attachEp = ep;
  const target = anchorTarget(app);
  if (!target) return false;
  const np = createAttached(app.layout, lc.ref, ep, target, piece.len ? { len: piece.len } : {});
  np.id = piece.id;
  app.layout.pieces.push(np);
  touch(app.layout);
  app.lastChained = { ...lc, ep };
  const next = continuationEndpoint(np, ep);
  app.anchor = next != null ? { pid: np.id, ep: next } : null;
  app.select([`p:${np.id}`]);
  app.commit();
  return true;
}

// Remove the last chained piece and go back to its anchor.
export function removeLast(app) {
  const lc = app.lastChained;
  if (!lc) return false;
  app.layout.pieces = app.layout.pieces.filter((p) => p.id !== lc.pid);
  app.anchor = findPiece(app.layout, lc.anchor.pid) ? lc.anchor : null;
  app.lastChained = null;
  app.clearSelection();
  app.commit();
  return true;
}

// Placement transform for a new piece near a world point: snaps to the
// nearest open endpoint within `snapDist`, otherwise free placement.
export function ghostPlacement(app, ref, x, y, snapDist) {
  const g = pieceGeometry({ ref });
  const tmp = { ref, x: 0, y: 0, rot: 0 };
  let best = null;
  for (const e of openEndpoints(app.layout)) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < snapDist && (!best || d < best.d)) best = { e, d };
  }
  const n = g.endpoints.length;
  let ep = app.attachEp % n;
  if (g.endpoints[ep].buffer) ep = g.endpoints.findIndex((e) => !e.buffer);
  if (best) {
    return { ...transformToEndpoint(tmp, ep, best.e), snapped: best.e, ep };
  }
  // free: centre the piece on the cursor
  let cx = 0, cy = 0;
  for (const e of g.endpoints) { cx += e.x; cy += e.y; }
  cx /= n; cy /= n;
  const r = rotate(cx, cy, app.placeRot);
  return { x: x - r.x, y: y - r.y, rot: app.placeRot, snapped: null, ep };
}

export function placeGhost(app, ref, placement) {
  const g = pieceGeometry({ ref });
  const extra = g.variable ? { len: g.variable.def } : {};
  const piece = createPiece(app.layout, ref, placement.x, placement.y, placement.rot, extra);
  if (placement.snapped) piece.h = piece.h.map(() => placement.snapped.z || 0);
  app.layout.pieces.push(piece);
  touch(app.layout);
  app.lastChained = placement.snapped
    ? { pid: piece.id, anchor: { pid: placement.snapped.pid, ep: placement.snapped.i }, ref, ep: placement.ep }
    : null;
  app.select([`p:${piece.id}`]);
  app.commit();
  return piece;
}

export function deleteSelection(app) {
  if (!app.selection.size) return;
  const L = app.layout;
  const pids = new Set(), sids = new Set(), tids = new Set();
  for (const k of app.selection) {
    const id = +k.slice(2);
    if (k[0] === 'p') pids.add(id);
    else if (k[0] === 's') sids.add(id);
    else if (k[0] === 't') tids.add(id);
  }
  L.pieces = L.pieces.filter((p) => !pids.has(p.id));
  L.scenery = L.scenery.filter((s) => !sids.has(s.id));
  L.trains = L.trains.filter((tr) => !tids.has(tr.id) && !tr.trail.some((e) => pids.has(e.pid)));
  if (app.lastChained && pids.has(app.lastChained.pid)) app.lastChained = null;
  app.selection.clear();
  app.commit();
  app.emit('trains');
}

function selectionCentre(app) {
  const pts = [];
  for (const p of app.selectedPieces()) for (const e of worldEndpoints(p)) pts.push(e);
  for (const s of app.selectedScenery()) pts.push(s);
  if (!pts.length) return null;
  const x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return { x, y };
}

export function rotateSelection(app, delta, about = null, commit = true) {
  const c = about || selectionCentre(app);
  if (!c) return;
  for (const obj of [...app.selectedPieces(), ...app.selectedScenery()]) {
    const r = rotate(obj.x - c.x, obj.y - c.y, delta);
    obj.x = c.x + r.x;
    obj.y = c.y + r.y;
    obj.rot = normAngle((obj.rot || 0) + delta);
  }
  touch(app.layout);
  if (commit) app.commit();
}

export function moveSelection(app, dx, dy) {
  for (const obj of [...app.selectedPieces(), ...app.selectedScenery()]) {
    obj.x += dx;
    obj.y += dy;
  }
  touch(app.layout);
}

// After a move: snap an open end of the selection to a nearby open end of
// the rest of the layout (rotating the selection to align).
export function snapSelection(app, snapDist) {
  const sel = app.selectedPieces();
  if (!sel.length) return false;
  const selIds = new Set(sel.map((p) => p.id));
  const opens = openEndpoints(app.layout);
  const mine = opens.filter((e) => selIds.has(e.pid));
  const others = opens.filter((e) => !selIds.has(e.pid));
  let best = null;
  for (const a of mine) {
    for (const b of others) {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < snapDist && angleDiff(a.a, b.a + Math.PI) < 25 * DEG && (!best || d < best.d)) best = { a, b, d };
    }
  }
  if (!best) return false;
  const dRot = normAngle(best.b.a + Math.PI - best.a.a);
  rotateSelection(app, dRot, { x: best.a.x, y: best.a.y }, false);
  moveSelection(app, best.b.x - best.a.x, best.b.y - best.a.y);
  // match heights of the whole selection to the target end
  const dz = (best.b.z || 0) - (best.a.z || 0);
  if (dz) for (const p of sel) p.h = p.h.map((h) => h + dz);
  return true;
}

// Select all pieces connected to `pid`.
export function connectedComponent(app, pid) {
  const conn = connections(app.layout);
  const seen = new Set([pid]);
  const stack = [pid];
  while (stack.length) {
    const id = stack.pop();
    const p = findPiece(app.layout, id);
    if (!p) continue;
    const n = pieceGeometry(p).endpoints.length;
    for (let i = 0; i < n; i++) {
      const o = conn.get(`${id}:${i}`);
      if (o && !seen.has(o.pid)) { seen.add(o.pid); stack.push(o.pid); }
    }
  }
  return [...seen];
}

export function toggleSwitch(app, pid) {
  const p = findPiece(app.layout, pid);
  const g = p && pieceGeometry(p);
  if (!g || !isSwitchable(g)) return false;
  p.state = ((p.state || 0) + 1) % g.states.length;
  app.emit('switch', p);
  app.scheduleSave();
  return true;
}

export function stateName(g, state) {
  const n = g.stateNames?.[state];
  return n ? t(n) : String(state);
}

export function addScenery(app, id, x, y, rot) {
  const st = sceneryType(id);
  if (!st) return null;
  const s = { id: newId(app.layout), kind: id, x, y, rot: rot || 0, scale: 1 };
  app.layout.scenery.push(s);
  app.select([`s:${s.id}`]);
  app.commit();
  return s;
}

export function defaultTrainName(app, consist) {
  const loco = consist.map(stock).find((s) => s && s.kind === 'loco');
  const n = app.layout.trains.length + 1;
  return loco ? `${n} · ${tr(loco.name)}` : `Train ${n}`;
}

export function addTrain(app, consist, cursor, name) {
  const train = {
    id: newId(app.layout), name: name || defaultTrainName(app, consist),
    consist: [...consist], trail: [], throttle: 0, speed: 0, reversed: false, shuttle: false,
  };
  if (!placeTrain(app.layout, train, cursor)) return null;
  app.layout.trains.push(train);
  app.activeTrain = train.id;
  app.emit('trains');
  app.scheduleSave();
  return train;
}
