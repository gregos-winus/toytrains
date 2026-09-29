import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_TYPES, trackType, pieceGeometry, R_TURNOUT } from '../js/catalog/tracks.js';
import {
  createLayout, createPiece, createAttached, worldEndpoints, connections, openEndpoints,
  serialize, deserialize, touch, applyBrush, terrainHeight, buildEmbankments,
} from '../js/model.js';
import { placeTrain, stepTrains, carPoses, reverseTrain, trainLength, kmhToMms } from '../js/sim.js';

const near = (a, b, eps = 0.05) => Math.abs(a - b) < eps;

// Chain pieces: each ref is attached with its endpoint 0 to the previous
// piece's endpoint `out` (default 1).
function chain(layout, start, refs) {
  let target = start;
  const pieces = [];
  for (const item of refs) {
    const [ref, inEp = 0, outEp = 1] = Array.isArray(item) ? item : [item];
    const p = createAttached(layout, ref, inEp, target);
    layout.pieces.push(p);
    pieces.push(p);
    target = worldEndpoints(p)[outEp];
  }
  touch(layout);
  return pieces;
}

function oval(layout) {
  const refs = [];
  for (let i = 0; i < 5; i++) refs.push('6120');
  refs.push('6101', '6101');
  for (let i = 0; i < 5; i++) refs.push('6120');
  refs.push('6101', '6101');
  return chain(layout, { x: 600, y: 100, a: Math.PI, z: 0 }, refs);
}

test('every track type has consistent routes and endpoints', () => {
  for (const t of TRACK_TYPES) {
    assert.ok(t.endpoints.length >= 1, t.ref);
    for (const r of t.routes) {
      assert.ok(r.len > 0, t.ref);
      assert.notEqual(r.from, r.to, t.ref);
    }
    for (const st of t.states) for (const ri of st) assert.ok(t.routes[ri], t.ref);
  }
});

test('ten R1 36° curves make a closed circle', () => {
  const layout = createLayout();
  const refs = Array(10).fill('6120');
  const ps = chain(layout, { x: 1000, y: 200, a: Math.PI, z: 0 }, refs);
  const last = worldEndpoints(ps[9])[1];
  assert.ok(near(last.x, 1000, 0.01) && near(last.y, 200, 0.01), JSON.stringify(last));
  assert.equal(openEndpoints(layout).length, 0);
});

test('R1 curve radius is 356.5 mm and 6120 spans 36°', () => {
  const g = trackType('6120');
  const e = g.endpoints[1];
  assert.ok(near(e.x, 356.5 * Math.sin(Math.PI / 5)));
  assert.ok(near(e.y, 356.5 * (1 - Math.cos(Math.PI / 5))));
});

test('turnout + 6138 gives parallel track at ~63.3 mm spacing', () => {
  const layout = createLayout();
  const [to] = chain(layout, { x: 100, y: 500, a: 0, z: 0 }, ['6170']);
  const branch = worldEndpoints(to)[2];
  // counter-curve: 6138 turning right, i.e. attached by its endpoint 1
  const [c] = chain(layout, branch, [['6138', 1, 0]]);
  const end = worldEndpoints(c)[0];
  assert.ok(near(Math.cos(end.a), 1, 1e-6), 'parallel');
  assert.ok(near(end.y - 500, 2 * R_TURNOUT * (1 - Math.cos(Math.PI / 10)), 0.01));
});

test('double slip curved routes end on the straight/diagonal endpoints', () => {
  for (const ref of ['6164', '6165']) {
    const g = trackType(ref);
    assert.equal(g.endpoints.length, 4, ref);
    // 4 routes, each endpoint used by exactly one route per state
    for (const st of g.states) {
      const used = st.flatMap((ri) => [g.routes[ri].from, g.routes[ri].to]).sort();
      assert.deepEqual(used, [0, 1, 2, 3], ref);
    }
  }
});

test('adjustable track 6110 respects its length', () => {
  const g = pieceGeometry({ ref: '6110', len: 117 });
  assert.ok(near(g.endpoints[1].x, 117));
  const g2 = pieceGeometry({ ref: '6110', len: 300 });
  assert.ok(near(g2.endpoints[1].x, 120));
});

test('oval closes and a train runs around it indefinitely', () => {
  const layout = createLayout();
  oval(layout);
  assert.equal(openEndpoints(layout).length, 0);
  const train = { id: 99, name: 't', consist: ['4234', '5125', '5125'], trail: [], throttle: 0, speed: 0 };
  layout.trains.push(train);
  const p0 = layout.pieces[5];
  assert.ok(placeTrain(layout, train, { pid: p0.id, ri: 0, s: 50, dir: 1 }));
  assert.equal(carPoses(layout, train).length, 3);
  train.throttle = 1;
  let travelled = 0;
  for (let i = 0; i < 3000; i++) {
    const before = train.speed;
    stepTrains(layout, 1 / 60);
    travelled += train.speed / 60;
    assert.ok(train.speed >= 0);
  }
  assert.ok(travelled > 3000, `travelled ${travelled}`);
  assert.ok(train.speed > kmhToMms(100));
  // cars stay coupled: consecutive car ends coincide
  const cars = carPoses(layout, train);
  for (let i = 1; i < cars.length; i++) {
    const a = cars[i - 1].ends[1], b = cars[i].ends[0];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.5);
  }
});

test('train stops at a buffer stop and can be reversed', () => {
  const layout = createLayout();
  chain(layout, { x: 100, y: 300, a: Math.PI, z: 0 }, ['6101', '6101', '6101', '6101', '6101', ['6116', 0, 0]]);
  const train = { id: 5, name: 't', consist: ['4225', '5205'], trail: [], throttle: 0, speed: 0 };
  layout.trains.push(train);
  assert.ok(placeTrain(layout, train, { pid: layout.pieces[1].id, ri: 0, s: 100, dir: 1 }));
  train.throttle = 1;
  let ended = false;
  for (let i = 0; i < 4000 && !ended; i++) {
    ended = stepTrains(layout, 1 / 60).some((e) => e.type === 'end');
  }
  assert.ok(ended);
  assert.equal(train.head.pid, layout.pieces[5].id);
  assert.ok(reverseTrain(layout, train));
  assert.equal(train.reversed, true);
  train.throttle = 0.5;
  for (let i = 0; i < 60; i++) stepTrains(layout, 1 / 60);
  assert.ok(train.speed > 0);
  assert.equal(trainLength(train), 120 + 116);
});

test('turnouts direct trains and are thrown when trailed', () => {
  const layout = createLayout();
  const lead = chain(layout, { x: 100, y: 300, a: Math.PI, z: 0 }, ['6101', '6101']);
  const [t] = chain(layout, worldEndpoints(lead[1])[1], ['6170']);
  const e = worldEndpoints(t);
  const straight = chain(layout, e[1], ['6101', '6101']);
  const branch = chain(layout, e[2], ['6138', '6101']);
  const train = { id: 7, name: 't', consist: ['4225'], trail: [], throttle: 0, speed: 0 };
  layout.trains.push(train);
  t.state = 1; // diverging
  assert.ok(placeTrain(layout, train, { pid: lead[0].id, ri: 0, s: 150, dir: 1 }));
  train.throttle = 1;
  const visited = new Set();
  for (let i = 0; i < 2000; i++) {
    stepTrains(layout, 1 / 60);
    visited.add(train.head.pid);
  }
  assert.ok(visited.has(branch[1].id), 'took the branch');
  assert.ok(!visited.has(straight[0].id), 'did not take the straight route');
  // now come back on the straight line with the turnout set to diverging:
  // the train trails through and throws it.
  const train2 = { id: 8, name: 't2', consist: ['4225'], trail: [], throttle: 0, speed: 0 };
  layout.trains = [train2];
  t.state = 1;
  assert.ok(placeTrain(layout, train2, { pid: straight[1].id, ri: 0, s: 150, dir: -1 }));
  train2.throttle = 1;
  let thrown = false;
  for (let i = 0; i < 2000; i++) {
    if (stepTrains(layout, 1 / 60).some((ev) => ev.type === 'thrown')) thrown = true;
  }
  assert.ok(thrown);
  assert.equal(t.state, 0);
});

test('serialisation round-trips pieces and terrain', () => {
  const layout = createLayout({ width: 1000, depth: 600 });
  oval(layout);
  applyBrush(layout.terrain, 500, 300, { radius: 100, strength: 30, mode: 'raise' });
  const h = terrainHeight(layout.terrain, 500, 300);
  assert.ok(h > 20);
  const copy = deserialize(JSON.parse(JSON.stringify(serialize(layout))));
  assert.equal(copy.pieces.length, layout.pieces.length);
  assert.ok(Math.abs(terrainHeight(copy.terrain, 500, 300) - h) < 0.3);
  assert.equal(openEndpoints(copy).length, 0);
});

test('embankments raise terrain under elevated track', () => {
  const layout = createLayout({ width: 1000, depth: 600 });
  const [p] = chain(layout, { x: 100, y: 300, a: 0, z: 40 }, ['6101']);
  assert.equal(p.h[0], 40);
  buildEmbankments(layout);
  assert.ok(terrainHeight(layout.terrain, 200, 300) > 35);
  assert.ok(terrainHeight(layout.terrain, 200, 500) < 1);
});
