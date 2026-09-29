import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExampleLayout } from '../js/examples.js';
import { openEndpoints, serialize, deserialize, worldEndpoints } from '../js/model.js';
import { stepTrains, carPoses } from '../js/sim.js';

test('example layout is closed and its trains run', () => {
  const L = buildExampleLayout();
  assert.equal(openEndpoints(L).length, 0, JSON.stringify(openEndpoints(L)));
  assert.equal(L.trains.length, 3);
  for (const t of L.trains) assert.ok(t.head && carPoses(L, t).length === t.consist.length, t.name);
  const tee = L.trains[0];
  let collisions = 0;
  for (let i = 0; i < 60 * 60; i++) {
    for (const ev of stepTrains(L, 1 / 60)) if (ev.type === 'collision') collisions++;
  }
  assert.equal(collisions, 0);
  assert.ok(tee.speed > 0);
  const copy = deserialize(JSON.parse(JSON.stringify(serialize(L))));
  assert.equal(copy.trains.length, 3);
  assert.ok(copy.scenery.length > 20);
});

test('example layout stays on the baseboard', () => {
  const L = buildExampleLayout();
  for (const p of L.pieces) {
    for (const e of worldEndpoints(p)) {
      assert.ok(e.x > 0 && e.x < L.board.w && e.y > 0 && e.y < L.board.d, `${p.ref} ${e.x},${e.y}`);
    }
  }
});
