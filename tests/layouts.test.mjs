import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS } from '../js/layouts/index.js';
import { openEndpoints, worldEndpoints, trackSamples, tunnelPortals, billOfMaterials } from '../js/model.js';
import { stepTrains, carPoses } from '../js/sim.js';
import { carveTerrain, terrainIndices, CLASS_CUT, CLASS_TUNNEL } from '../js/carve.js';

for (const def of LAYOUTS) {
  test(`layout "${def.id}" is closed, on the board, and its trains run without collision`, () => {
    const L = def.build();
    assert.equal(openEndpoints(L).length, 0, `open ends: ${JSON.stringify(openEndpoints(L).map((e) => [e.x, e.y]))}`);
    for (const p of L.pieces) {
      for (const e of worldEndpoints(p)) {
        assert.ok(e.x > 0 && e.y > 0 && e.x < L.board.w && e.y < L.board.d, `${def.id}: ${p.ref} off board`);
      }
    }
    assert.ok(L.trains.length >= 2);
    for (const t of L.trains) assert.equal(carPoses(L, t).length, t.consist.length, t.name);
    const moving = L.trains.filter((t) => t.throttle > 0);
    assert.ok(moving.length >= 1);
    for (let i = 0; i < 60 * 60; i++) {
      for (const ev of stepTrains(L, 1 / 60)) assert.notEqual(ev.type, 'collision', `${def.id}: ${ev.train.name}`);
    }
    for (const t of moving) assert.ok(t.speed > 0, `${t.name} stopped`);
    assert.ok(billOfMaterials(L).length > 2);
  });
}

test('complex layouts are really complex', () => {
  const byId = Object.fromEntries(LAYOUTS.map((d) => [d.id, d.build()]));
  const turnouts = (L) => L.pieces.filter((p) => /^61(5|7)/.test(p.ref)).length;
  assert.ok(byId.mainline.pieces.length > 80 && turnouts(byId.mainline) >= 8);
  const heights = byId.mountain.pieces.flatMap((p) => p.h);
  assert.ok(Math.max(...heights) >= 80, 'mountain line has an upper level');
});

test('tunnels are detected and their mouths are open in the rendered terrain', () => {
  const L = LAYOUTS.find((d) => d.id === 'village').build();
  const routes = trackSamples(L);
  const portals = tunnelPortals(routes);
  assert.equal(portals.length, 2);
  const c = carveTerrain(L, routes);
  let cut = 0, tun = 0;
  for (const v of c.cls) { if (v === CLASS_CUT) cut++; if (v === CLASS_TUNNEL) tun++; }
  assert.ok(cut > 0 && tun > 0);
  // triangles joining a cutting and a tunnel are removed near each portal
  const full = (c.nx - 1) * (c.ny - 1) * 2 * 3;
  assert.ok(terrainIndices(c).length < full);
  // the track is visible (terrain carved down) just outside each portal
  for (const p of portals) {
    const x = p.x + Math.cos(p.a) * 40, y = p.y + Math.sin(p.a) * 40;
    const i = Math.round(x / c.cell), j = Math.round(y / c.cell);
    assert.ok(c.heights[j * c.nx + i] <= p.z + 1, 'cutting in front of the portal');
    const xi = p.x - Math.cos(p.a) * 60, yi = p.y - Math.sin(p.a) * 60;
    const ii = Math.round(xi / c.cell), ji = Math.round(yi / c.cell);
    assert.ok(c.heights[ji * c.nx + ii] > p.z + 80, 'terrain above the vault inside');
  }
});
