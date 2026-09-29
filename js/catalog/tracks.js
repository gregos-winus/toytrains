// Fleischmann HO "Profi-Gleis" track system (code 100 rail on a moulded
// ballast bed). Geometry sources: Fleischmann product descriptions
// (see docs). All values are in millimetres and degrees.
//
// Every piece type is described by its routes (paths a wheel can follow).
// Endpoints are derived from the routes. A piece instance is placed with a
// transform {x, y, rot}.

import { DEG, pathEnd, pathLength, dist, normAngle } from '../geom.js';

export const GAUGE = 16.5;          // HO track gauge
export const BED_WIDTH = 38;        // Profi-Gleis ballast bed width (approx.)
export const BED_HEIGHT = 5;        // height of bed + rail top above base
export const TRACK_SPACING = 63.5;  // R2 - R1, parallel track spacing

export const R1 = 356.5;
export const R2 = 420;
export const R3 = 483.5;
export const R4 = 547;
export const R_TURNOUT = 647;       // branch radius of the 18° turnouts (= 6138)

const line = (len) => ({ type: 'line', len });
const arc = (r, deg) => ({ type: 'arc', r, angle: deg * DEG });

// Build a type from a list of routes. Each route: { start:{x,y,a}, segs }.
// Explicit `buffers` lists route ends that are buffer stops (not connectable).
function build(def) {
  const endpoints = [];
  const findOrAdd = (x, y, a, extra = {}) => {
    for (let i = 0; i < endpoints.length; i++) {
      if (dist(endpoints[i], { x, y }) < 0.8) return i;
    }
    endpoints.push({ x, y, a: normAngle(a), ...extra });
    return endpoints.length - 1;
  };
  const routes = def.routes.map((r, idx) => {
    const end = pathEnd(r.start, r.segs);
    const from = findOrAdd(r.start.x, r.start.y, r.start.a + Math.PI);
    const to = findOrAdd(end.x, end.y, end.a, r.bufferEnd ? { buffer: true } : {});
    return { idx, from, to, start: { ...r.start }, segs: r.segs, len: pathLength(r.segs) };
  });
  const states = def.states || [routes.map((r) => r.idx)];
  return { ...def, endpoints, routes, states };
}

const S = (x = 0, y = 0, a = 0) => ({ x, y, a });

function straight(ref, len, name, extra = {}) {
  return build({
    ref, kind: 'straight', name, len,
    routes: [{ start: S(), segs: [line(len)] }],
    ...extra,
  });
}

function curve(ref, r, deg, name) {
  return build({
    ref, kind: 'curve', name, radius: r, angle: deg,
    routes: [{ start: S(), segs: [arc(r, deg)] }],
  });
}

// 18° standard turnout, 200 mm, branch R647 (hand = +1 left, -1 right)
function turnout(ref, hand, electric, name) {
  return build({
    ref, kind: 'turnout', name, hand, electric,
    routes: [
      { start: S(), segs: [line(200)] },
      { start: S(), segs: [arc(R_TURNOUT, 18 * hand)] },
    ],
    states: [[0], [1]],
    stateNames: ['straight', 'diverging'],
  });
}

function threeWay(ref, electric, name) {
  return build({
    ref, kind: 'threeway', name, electric,
    routes: [
      { start: S(), segs: [line(200)] },
      { start: S(), segs: [arc(R_TURNOUT, 18)] },
      { start: S(), segs: [arc(R_TURNOUT, -18)] },
    ],
    states: [[0], [1], [2]],
    stateNames: ['straight', 'left', 'right'],
  });
}

// Curved turnout: inner route R1 36°, outer route R2 36° (approximation of
// the Profi-Gleis 6174/6175 geometry).
function curvedTurnout(ref, hand, electric, name) {
  return build({
    ref, kind: 'curvedturnout', name, hand, electric,
    routes: [
      { start: S(), segs: [arc(R2, 36 * hand)] },
      { start: S(), segs: [arc(R1, 36 * hand)] },
    ],
    states: [[0], [1]],
    stateNames: ['outer', 'inner'],
  });
}

// Crossing: straight of length ls, diagonal of length ld at angle deg,
// both centred on the origin.
function crossing(ref, ls, ld, deg, name) {
  const a = deg * DEG;
  return build({
    ref, kind: 'crossing', name, angle: deg,
    routes: [
      { start: S(-ls / 2, 0, 0), segs: [line(ls)] },
      { start: S((-ld / 2) * Math.cos(a), (-ld / 2) * Math.sin(a), a), segs: [line(ld)] },
    ],
  });
}

// Double slip (DKW) 18°, 200 mm. hand = +1 left-crossing, -1 right-crossing.
// The curved routes are R647 arcs, the diagonal joins their ends.
function doubleSlip(ref, hand, electric, name) {
  const s0 = S(-100, 0, 0);
  const e3 = pathEnd(s0, [arc(R_TURNOUT, 18 * hand)]);
  const s2 = S(-e3.x, -e3.y, e3.a);
  const diagA = Math.atan2(e3.y - s2.y, e3.x - s2.x);
  const diagLen = Math.hypot(e3.x - s2.x, e3.y - s2.y);
  return build({
    ref, kind: 'doubleslip', name, hand, electric,
    routes: [
      { start: s0, segs: [line(200)] },                        // 0: straight
      { start: s0, segs: [arc(R_TURNOUT, 18 * hand)] },        // 1: curve A
      { start: s2, segs: [arc(R_TURNOUT, -18 * hand)] },       // 2: curve B
      { start: S(s2.x, s2.y, diagA), segs: [line(diagLen)] },  // 3: diagonal
    ],
    states: [[0, 3], [1, 2]],
    stateNames: ['crossing', 'turning'],
  });
}

const N = (en, fr) => ({ en, fr });

export const TRACK_TYPES = [
  // --- straights
  straight('6101', 200, N('Straight track 200 mm', 'Voie droite 200 mm')),
  straight('6102', 105, N('Straight track 105 mm', 'Voie droite 105 mm')),
  straight('6103', 100, N('Straight track 100 mm', 'Voie droite 100 mm')),
  build({
    ref: '6110', kind: 'straight', variable: { min: 80, max: 120, def: 100 },
    name: N('Adjustable straight 80–120 mm', 'Voie droite réglable 80–120 mm'),
    routes: [{ start: S(), segs: [line(100)] }],
  }),
  build({
    ref: '6116', kind: 'buffer', name: N('Buffer stop track 105 mm', 'Voie heurtoir 105 mm'),
    routes: [{ start: S(), segs: [line(105)], bufferEnd: true }],
  }),
  // --- curves
  curve('6120', R1, 36, N('Curve R1 356.5 mm, 36°', 'Courbe R1 356,5 mm, 36°')),
  curve('6122', R1, 18, N('Curve R1 356.5 mm, 18°', 'Courbe R1 356,5 mm, 18°')),
  curve('6125', R2, 36, N('Curve R2 420 mm, 36°', 'Courbe R2 420 mm, 36°')),
  curve('6127', R2, 18, N('Curve R2 420 mm, 18°', 'Courbe R2 420 mm, 18°')),
  curve('6131', R3, 18, N('Curve R3 483.5 mm, 18°', 'Courbe R3 483,5 mm, 18°')),
  curve('6133', R4, 18, N('Curve R4 547 mm, 18°', 'Courbe R4 547 mm, 18°')),
  curve('6138', R_TURNOUT, 18, N('Turnout curve R 647 mm, 18°', 'Courbe d’aiguillage R 647 mm, 18°')),
  // --- turnouts
  turnout('6170', 1, false, N('Turnout left, manual, 18°', 'Aiguillage gauche, manuel, 18°')),
  turnout('6171', -1, false, N('Turnout right, manual, 18°', 'Aiguillage droit, manuel, 18°')),
  turnout('6172', 1, true, N('Turnout left, electric, 18°', 'Aiguillage gauche, électrique, 18°')),
  turnout('6173', -1, true, N('Turnout right, electric, 18°', 'Aiguillage droit, électrique, 18°')),
  curvedTurnout('6174', 1, false, N('Curved turnout left R1/R2', 'Aiguillage courbe gauche R1/R2')),
  curvedTurnout('6175', -1, false, N('Curved turnout right R1/R2', 'Aiguillage courbe droit R1/R2')),
  threeWay('6157', false, N('Three-way turnout 18°', 'Aiguillage triple 18°')),
  // --- crossings
  crossing('6160', 105, 105, 36, N('Crossing 36°, 105 mm', 'Croisement 36°, 105 mm')),
  crossing('6162', 200, 210, 18, N('Crossing 18° left, 200 mm', 'Croisement 18° gauche, 200 mm')),
  crossing('6163', 200, 210, -18, N('Crossing 18° right, 200 mm', 'Croisement 18° droit, 200 mm')),
  doubleSlip('6164', 1, false, N('Double slip left, manual', 'TJD gauche, manuelle')),
  doubleSlip('6165', -1, false, N('Double slip right, manual', 'TJD droite, manuelle')),
  doubleSlip('6166', 1, true, N('Double slip left, electric', 'TJD gauche, électrique')),
  doubleSlip('6167', -1, true, N('Double slip right, electric', 'TJD droite, électrique')),
];

export const TRACK_GROUPS = [
  { id: 'straight', name: N('Straights', 'Voies droites'), kinds: ['straight', 'buffer'] },
  { id: 'curve', name: N('Curves', 'Courbes'), kinds: ['curve'] },
  { id: 'turnout', name: N('Turnouts', 'Aiguillages'), kinds: ['turnout', 'curvedturnout', 'threeway'] },
  { id: 'crossing', name: N('Crossings & slips', 'Croisements & TJD'), kinds: ['crossing', 'doubleslip'] },
];

const byRef = new Map(TRACK_TYPES.map((t) => [t.ref, t]));
const variableCache = new Map();

export function trackType(ref) {
  return byRef.get(ref);
}

// Geometry for a piece instance (handles variable-length pieces).
export function pieceGeometry(piece) {
  const t = byRef.get(piece.ref);
  if (!t) return null;
  if (!t.variable) return t;
  const len = Math.min(t.variable.max, Math.max(t.variable.min, piece.len || t.variable.def));
  const key = `${t.ref}:${len}`;
  let g = variableCache.get(key);
  if (!g) {
    g = build({ ...t, routes: [{ start: S(), segs: [line(len)] }], len });
    variableCache.set(key, g);
  }
  return g;
}

export function isSwitchable(t) {
  return t && t.states && t.states.length > 1;
}
