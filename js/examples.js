// Example layout built programmatically from Fleischmann Profi-Gleis pieces.

import {
  createLayout, createAttached, worldEndpoints, touch, applyBrush, terrainHeight, routePose, newId,
} from './model.js';
import { pieceGeometry } from './catalog/tracks.js';
import { placeTrain } from './sim.js';

function chain(layout, start, items) {
  let target = start;
  const out = [];
  for (const item of items) {
    const [ref, inEp = 0, outEp = 1] = Array.isArray(item) ? item : [item];
    const p = createAttached(layout, ref, inEp, target);
    layout.pieces.push(p);
    out.push(p);
    target = worldEndpoints(p)[outEp];
  }
  touch(layout);
  return out;
}

const rep = (ref, n) => Array(n).fill(ref);

export function buildExampleLayout(name = 'Demo') {
  const L = createLayout({ width: 2400, depth: 1200, name });
  const T = L.terrain;

  // --- relief: a hill on the left (tunnel), a lake and a river valley
  for (let i = 0; i < 45; i++) applyBrush(T, 230, 600, { radius: 380, strength: 5, mode: 'raise' });
  for (let i = 0; i < 20; i++) applyBrush(T, 120, 380, { radius: 220, strength: 4, mode: 'raise' });
  for (let i = 0; i < 6; i++) applyBrush(T, 230, 600, { radius: 420, strength: 1, mode: 'smooth' });
  for (let i = 0; i < 18; i++) applyBrush(T, 1150, 640, { radius: 170, strength: 5, mode: 'lower' });
  for (let y = 1200; y >= 700; y -= 20) {
    for (let k = 0; k < 4; k++) applyBrush(T, 1300 + (y - 1000) * 0.3, y, { radius: 60, strength: 5, mode: 'lower' });
  }
  for (let i = 0; i < 4; i++) applyBrush(T, 1150, 640, { radius: 260, strength: 1, mode: 'smooth' });
  // ground cover
  for (let j = 0; j < T.ny; j++) {
    for (let i = 0; i < T.nx; i++) {
      const k = j * T.nx + i;
      const h = T.heights[k];
      if (h > 150) T.paint[k] = 3;        // rock
      else if (h > 60) T.paint[k] = 0;    // grass
      else if (h < -2) T.paint[k] = 4;    // sand (shores)
      else T.paint[k] = Math.sin(i * 0.23) + Math.sin(j * 0.31 + i * 0.07) > 0.9 ? 1 : 0;
    }
  }

  // --- main line: oval R2 with a passing loop (station) and a siding
  const start = { x: 500, y: 150, a: 0, z: 0 };
  const bottom = chain(L, start, ['6170', ...rep('6101', 5)]);
  const loop = chain(L, worldEndpoints(bottom[0])[2], [['6138', 1, 0], ...rep('6101', 3), ['6138', 1, 0], ['6171', 2, 0]]);
  const farTurnout = loop[loop.length - 1];
  const right = chain(L, worldEndpoints(farTurnout)[0], rep('6125', 5));
  const top = chain(L, worldEndpoints(right[4])[1], ['6171', ...rep('6101', 6)]);
  const left = chain(L, worldEndpoints(top[6])[1], rep('6125', 5));
  const siding = chain(L, worldEndpoints(top[0])[2], [['6138', 0, 1], '6101', '6101', ['6116', 0, 0]]);
  touch(L);

  // flatten the terrain close to the station and around the tracks near the
  // board edges, keep the hill over the left curve (tunnel)
  for (const p of [...bottom, ...loop, ...top, ...siding]) {
    const g = pieceGeometry(p);
    for (const r of g.routes) {
      for (let s = 0; s <= r.len; s += 20) {
        const q = routePose(p, g, r, s);
        if (terrainHeight(T, q.x, q.y) > -10) applyBrush(T, q.x, q.y, { radius: 60, strength: 1, mode: 'flatten', target: 0 });
      }
    }
  }

  const scen = [];

  // --- scenery
  scen.push(
    { kind: 'platform', x: 1100, y: 257, rot: 0 },
    { kind: 'station', x: 1100, y: 345, rot: 0 },
    { kind: 'signalbox', x: 690, y: 290, rot: 0 },
    { kind: 'signal', x: 480, y: 185, rot: 0 },
    { kind: 'signal', x: 1720, y: 115, rot: Math.PI },
    { kind: 'engineshed', x: 1330, y: 1053, rot: 0 },
    { kind: 'watertower', x: 1580, y: 1120, rot: 0 },
    { kind: 'road', x: 1450, y: 420, rot: 0 },
    { kind: 'road', x: 1650, y: 420, rot: 0 },
    { kind: 'house', x: 1450, y: 330, rot: 0.1 },
    { kind: 'timbered', x: 1600, y: 320, rot: -0.05 },
    { kind: 'house', x: 1720, y: 520, rot: Math.PI / 2 },
    { kind: 'church', x: 1560, y: 560, rot: 0 },
    { kind: 'car', x: 1420, y: 420, rot: 0 },
    { kind: 'factory', x: 2080, y: 1080, rot: 0 },
    { kind: 'farm', x: 850, y: 1110, rot: 0 },
    { kind: 'rock', x: 260, y: 700, rot: 0.4 },
    { kind: 'rock', x: 300, y: 520, rot: 1.2 },
  );
  const trees = [
    [150, 820, 'conifer'], [230, 860, 'conifer'], [330, 800, 'conifer'], [200, 300, 'conifer'], [140, 450, 'conifer'],
    [950, 600, 'tree'], [1000, 760, 'tree'], [1290, 520, 'tree'], [1330, 760, 'bush'], [980, 520, 'bush'],
    [1860, 330, 'tree'], [1900, 470, 'tree'], [2050, 820, 'tree'], [2150, 950, 'conifer'], [700, 900, 'tree'],
    [780, 960, 'bush'], [620, 700, 'tree'], [1780, 720, 'tree'], [2250, 600, 'conifer'], [2240, 250, 'tree'],
    [1100, 1150, 'tree'], [1200, 1140, 'bush'], [400, 1120, 'conifer'], [520, 1140, 'conifer'],
  ];
  for (const [x, y, kind] of trees) scen.push({ kind, x, y, rot: (x * 13 + y) % 6, scale: 0.85 + ((x + y) % 40) / 100 });
  for (const s of scen) L.scenery.push({ id: newId(L), scale: 1, ...s });

  // --- trains
  const mk = (name, consist) => ({ id: newId(L), name, consist, trail: [], throttle: 0, speed: 0, reversed: false, shuttle: false });
  const tee = mk('TEE « Rheingold »', ['4375', '5161', '5161', '5161']);
  placeTrain(L, tee, { pid: top[4].id, ri: 0, s: 50, dir: 1 });
  tee.throttle = 0.45;
  const freight = mk('Güterzug BR 50', ['4175', '5205', '5205', '5220', '5205']);
  placeTrain(L, freight, { pid: loop[3].id, ri: 0, s: 190, dir: 1 });
  const shunter = mk('V 60', ['4225', '5220']);
  placeTrain(L, shunter, { pid: siding[2].id, ri: 0, s: 60, dir: 1 });
  L.trains.push(tee, freight, shunter);
  touch(L);
  return L;
}
