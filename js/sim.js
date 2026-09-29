// Train movement along the track graph.
//
// A cursor is a position on a piece route: {pid, ri, s, dir}, where s is
// the distance from the route's `from` endpoint and dir = +1 when moving
// towards `to`, -1 when moving towards `from`.
//
// A train keeps its `head` cursor plus a `trail` of the route traversals
// it has occupied (oldest first, the last one is the head's route). Cars
// are laid out by walking back along the trail, so they follow exactly the
// path the locomotive took even if a turnout is thrown behind it.

import { pieceGeometry, isSwitchable } from './catalog/tracks.js';
import { stock } from './catalog/rolling-stock.js';
import { connections, findPiece, routePose } from './model.js';

export const HO_SCALE = 87;
export const kmhToMms = (kmh) => (kmh / 3.6) * 1000 / HO_SCALE;
export const mmsToKmh = (mms) => (mms * HO_SCALE * 3.6) / 1000;

const ACCEL = 90;   // mm/s² (model scale)
const BRAKE = 160;  // mm/s²

export function trainLength(train) {
  return train.consist.reduce((s, ref) => s + (stock(ref)?.length || 100), 0);
}

export function trainVmax(train) {
  const locos = train.consist.map(stock).filter((s) => s && s.kind === 'loco');
  if (!locos.length) return 0;
  return Math.min(...locos.map((l) => l.vmax));
}

// Choose the route to take when entering piece `pid` through endpoint `ep`.
// Returns {ri, dir, thrown} or null. Prefers routes active in the current
// switch state; otherwise (trailing through a switch set against us) the
// switch is thrown if autoThrow is set.
export function enterPiece(layout, pid, ep, autoThrow = true) {
  const piece = findPiece(layout, pid);
  if (!piece) return null;
  const g = pieceGeometry(piece);
  const active = g.states[piece.state || 0] || g.states[0];
  let r = g.routes.find((rt) => active.includes(rt.idx) && (rt.from === ep || rt.to === ep));
  let thrown = false;
  if (!r) {
    r = g.routes.find((rt) => rt.from === ep || rt.to === ep);
    if (!r) return null;
    if (isSwitchable(g) && autoThrow) {
      const st = g.states.findIndex((s) => s.includes(r.idx));
      if (st >= 0) { piece.state = st; thrown = true; }
    }
  }
  return { ri: r.idx, dir: r.from === ep ? 1 : -1, thrown };
}

// Move cursor forward by ds (>= 0). Returns {cur, entered, blocked, rest, thrown}
export function advance(layout, cur, ds, autoThrow = true) {
  const conn = connections(layout);
  cur = { ...cur };
  const entered = [];
  const thrown = [];
  for (let guard = 0; guard < 1000; guard++) {
    const piece = findPiece(layout, cur.pid);
    if (!piece) return { cur, entered, blocked: true, rest: ds, thrown };
    const g = pieceGeometry(piece);
    const route = g.routes[cur.ri];
    const room = cur.dir > 0 ? route.len - cur.s : cur.s;
    if (ds <= room) {
      cur.s += cur.dir * ds;
      return { cur, entered, blocked: false, rest: 0, thrown };
    }
    ds -= room;
    cur.s = cur.dir > 0 ? route.len : 0;
    const exitEp = cur.dir > 0 ? route.to : route.from;
    const nb = conn.get(`${cur.pid}:${exitEp}`);
    if (!nb) return { cur, entered, blocked: true, rest: ds, thrown };
    const next = enterPiece(layout, nb.pid, nb.ep, autoThrow);
    if (!next) return { cur, entered, blocked: true, rest: ds, thrown };
    if (next.thrown) thrown.push(nb.pid);
    const ng = pieceGeometry(findPiece(layout, nb.pid));
    cur = { pid: nb.pid, ri: next.ri, dir: next.dir, s: next.dir > 0 ? 0 : ng.routes[next.ri].len };
    entered.push({ pid: cur.pid, ri: cur.ri, dir: cur.dir });
  }
  return { cur, entered, blocked: true, rest: ds, thrown };
}

function routeOf(layout, e) {
  const piece = findPiece(layout, e.pid);
  if (!piece) return null;
  const g = pieceGeometry(piece);
  const route = g.routes[e.ri];
  return route ? { piece, g, route } : null;
}

// Pose at distance `back` behind the head, walking the trail.
export function poseBehind(layout, train, back) {
  const tr = train.trail;
  const h = train.head;
  let d = back;
  for (let i = tr.length - 1; i >= 0; i--) {
    const e = tr[i];
    const r = routeOf(layout, e);
    if (!r) return null;
    const L = r.route.len;
    // position (s) of the exit side of this traversal
    const sExit = i === tr.length - 1 ? h.s : (e.dir > 0 ? L : 0);
    const avail = e.dir > 0 ? sExit : L - sExit;
    if (d <= avail || i === 0) {
      const s = sExit - e.dir * Math.min(d, avail);
      const pose = routePose(r.piece, r.g, r.route, s);
      if (e.dir < 0) pose.a += Math.PI;
      return pose;
    }
    d -= avail;
  }
  return null;
}

// Length of track covered by the trail.
function trailLength(layout, train) {
  let L = 0;
  const tr = train.trail;
  for (let i = 0; i < tr.length; i++) {
    const r = routeOf(layout, tr[i]);
    if (!r) continue;
    if (i === tr.length - 1) L += tr[i].dir > 0 ? train.head.s : r.route.len - train.head.s;
    else L += r.route.len;
  }
  return L;
}

function trimTrail(layout, train) {
  const need = trainLength(train) + 30;
  while (train.trail.length > 1) {
    const r = routeOf(layout, train.trail[0]);
    const L = r ? r.route.len : 0;
    if (trailLength(layout, train) - L >= need) train.trail.shift();
    else break;
  }
}

// Place a train with its head at a cursor. The train extends backwards from
// the head. If there is not enough track behind, the head is pushed forward.
// Returns true on success.
export function placeTrain(layout, train, cursor) {
  const len = trainLength(train) + 2;
  // walk backwards from the head
  const back = advance(layout, { ...cursor, dir: -cursor.dir }, len, false);
  let head = { ...cursor };
  if (back.blocked) {
    // not enough room behind: move head forward by the deficit
    const fwd = advance(layout, cursor, back.rest, false);
    if (fwd.blocked) return false;
    head = fwd.cur;
  }
  // rebuild from the tail: walk from the tail forwards to the head
  const tailWalk = advance(layout, { ...head, dir: -head.dir }, len, false);
  if (tailWalk.blocked) return false;
  const tailCur = { ...tailWalk.cur, dir: -tailWalk.cur.dir };
  const fwd = advance(layout, tailCur, len, false);
  train.trail = [{ pid: tailCur.pid, ri: tailCur.ri, dir: tailCur.dir }, ...fwd.entered];
  train.head = fwd.cur;
  train.speed = 0;
  trimTrail(layout, train);
  return true;
}

// Reverse the running direction: the tail becomes the head.
export function reverseTrain(layout, train) {
  const len = trainLength(train);
  const tail = poseCursorBehind(layout, train, len);
  if (!tail) return false;
  const newTrail = [];
  // traversals from tail to head, reversed
  for (let i = train.trail.length - 1; i >= tail.index; i--) {
    const e = train.trail[i];
    newTrail.push({ pid: e.pid, ri: e.ri, dir: -e.dir });
  }
  train.trail = newTrail;
  train.head = { pid: tail.pid, ri: tail.ri, s: tail.s, dir: -tail.dir };
  train.reversed = !train.reversed;
  train.speed = 0;
  trimTrail(layout, train);
  return true;
}

// Cursor located `back` mm behind the head, with trail index.
function poseCursorBehind(layout, train, back) {
  const tr = train.trail;
  let d = back;
  for (let i = tr.length - 1; i >= 0; i--) {
    const e = tr[i];
    const r = routeOf(layout, e);
    if (!r) return null;
    const L = r.route.len;
    const sExit = i === tr.length - 1 ? train.head.s : (e.dir > 0 ? L : 0);
    const avail = e.dir > 0 ? sExit : L - sExit;
    if (d <= avail || i === 0) {
      return { pid: e.pid, ri: e.ri, dir: e.dir, s: sExit - e.dir * Math.min(d, avail), index: i };
    }
    d -= avail;
  }
  return null;
}

// Car placements: [{ref, front:{x,y,z}, rear:{x,y,z}, x, y, z, a, flip}]
export function carPoses(layout, train) {
  const refs = train.reversed ? [...train.consist].reverse() : train.consist;
  const out = [];
  let off = 0;
  for (const ref of refs) {
    const st = stock(ref);
    const L = st?.length || 100;
    const inset = Math.min(L * 0.2, 45);
    const f = poseBehind(layout, train, off + inset);
    const r = poseBehind(layout, train, off + L - inset);
    const fEnd = poseBehind(layout, train, off);
    const rEnd = poseBehind(layout, train, off + L);
    if (f && r) {
      const a = Math.atan2(f.y - r.y, f.x - r.x);
      out.push({
        ref, st, length: L,
        x: (f.x + r.x) / 2, y: (f.y + r.y) / 2, z: (f.z + r.z) / 2,
        a, pitch: Math.atan2(f.z - r.z, Math.hypot(f.x - r.x, f.y - r.y)),
        flip: !!train.reversed,
        ends: [fEnd, rEnd],
      });
    }
    off += L;
  }
  return out;
}

// Advance the simulation by dt seconds. Returns a list of events.
export function stepTrains(layout, dt) {
  const events = [];
  for (const train of layout.trains) {
    if (!train.head) continue;
    const vmax = kmhToMms(trainVmax(train));
    const target = (train.throttle || 0) * vmax;
    const sp = train.speed || 0;
    if (sp < target) train.speed = Math.min(target, sp + ACCEL * dt);
    else if (sp > target) train.speed = Math.max(target, sp - BRAKE * dt);
    if (train.speed <= 0) continue;
    const res = advance(layout, train.head, train.speed * dt, true);
    train.head = res.cur;
    for (const e of res.entered) train.trail.push(e);
    for (const pid of res.thrown) events.push({ type: 'thrown', train, pid });
    trimTrail(layout, train);
    if (res.blocked) {
      train.speed = 0;
      if (train.shuttle) {
        reverseTrain(layout, train);
        events.push({ type: 'shuttle', train });
      } else {
        train.throttle = 0;
        events.push({ type: 'end', train });
      }
    }
  }
  // collisions between trains (only when they get closer to each other)
  const hulls = layout.trains.filter((t) => t.head).map((t) => ({ t, pts: trainPoints(layout, t) }));
  const prox = layout._prox || (layout._prox = new Map());
  for (let i = 0; i < hulls.length; i++) {
    for (let j = i + 1; j < hulls.length; j++) {
      const a = hulls[i], b = hulls[j];
      const key = `${a.t.id}:${b.t.id}`;
      const d = minDistance(a.pts, b.pts);
      const prev = prox.get(key);
      prox.set(key, d);
      if (d < 22 && prev !== undefined && d < prev - 0.01) {
        for (const t of [a.t, b.t]) {
          if (t.speed > 0) { t.speed = 0; t.throttle = 0; events.push({ type: 'collision', train: t }); }
        }
      }
    }
  }
  return events;
}

function trainPoints(layout, train) {
  const out = [];
  for (const c of carPoses(layout, train)) {
    out.push(c);
    for (const e of c.ends) if (e) out.push(e);
  }
  return out;
}

function minDistance(pa, pb) {
  let m = Infinity;
  for (const p of pa) for (const q of pb) {
    if (Math.abs(p.z - q.z) > 40) continue;
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < m) m = d;
  }
  return m;
}

// Locate the nearest route position to a world point.
// Returns {pid, ri, s, dist, a} or null.
export function nearestTrackPoint(layout, x, y, maxDist = 30) {
  let best = null;
  for (const piece of layout.pieces) {
    const g = pieceGeometry(piece);
    if (!g) continue;
    if (Math.hypot(piece.x - x, piece.y - y) > 700) continue;
    const active = g.states[piece.state || 0] || g.states[0];
    for (const r of g.routes) {
      const n = Math.max(4, Math.ceil(r.len / 5));
      for (let k = 0; k <= n; k++) {
        const s = (r.len * k) / n;
        const p = routePose(piece, g, r, s);
        let d = Math.hypot(p.x - x, p.y - y);
        if (!active.includes(r.idx)) d += 3; // prefer active routes
        if (d < maxDist && (!best || d < best.dist)) best = { pid: piece.id, ri: r.idx, s, dist: d, a: p.a };
      }
    }
  }
  return best;
}
