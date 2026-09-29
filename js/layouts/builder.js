// Small DSL used to build the example layouts from Fleischmann pieces.
//
//   const b = new Builder(layout);
//   const c = b.at(500, 150, 0);        // cursor at x, y, heading (deg)
//   c.straight(3).left('6125', 5);       // pieces are chained one after another
//   const branch = c.turnout('6170');    // continue straight, get the branch
//
// A cursor holds the open end the next piece attaches to. `grade` makes the
// following pieces climb (0.03 = 3 %).

import { createAttached, worldEndpoints, touch, newId, applyBrush } from '../model.js';
import { pieceGeometry } from '../catalog/tracks.js';
import { placeTrain } from '../sim.js';
import { DEG } from '../geom.js';

export class Cursor {
  constructor(builder, target) {
    this.b = builder;
    this.t = { ...target };
    this.grade = 0;
    this.pieces = [];
  }

  get layout() { return this.b.layout; }

  place(ref, inEp = 0, outEp = 1, extra = {}) {
    const p = createAttached(this.layout, ref, inEp, this.t, extra);
    const g = pieceGeometry(p);
    if (this.grade && g.endpoints.length === 2) {
      p.h[outEp] = (this.t.z || 0) + this.grade * g.routes[0].len;
    }
    this.layout.pieces.push(p);
    this.pieces.push(p);
    this.b.all.push(p);
    this.last = p;
    this.t = worldEndpoints(p)[outEp];
    touch(this.layout);
    return p;
  }

  straight(n = 1, ref = '6101') {
    for (let i = 0; i < n; i++) this.place(ref, 0, 1);
    return this;
  }

  adjust(len) {
    this.place('6110', 0, 1, { len });
    return this;
  }

  left(ref = '6125', n = 1) {
    for (let i = 0; i < n; i++) this.place(ref, 0, 1);
    return this;
  }

  right(ref = '6125', n = 1) {
    for (let i = 0; i < n; i++) this.place(ref, 1, 0);
    return this;
  }

  // Facing turnout: enter by the common end. Continues on `go` and returns a
  // cursor on the other route.
  turnout(ref, go = 'straight') {
    const p = this.place(ref, 0, go === 'straight' ? 1 : 2);
    const other = new Cursor(this.b, worldEndpoints(p)[go === 'straight' ? 2 : 1]);
    other.grade = 0;
    return other;
  }

  // Three-way turnout: continues straight, returns [left, right] cursors.
  threeWay(ref = '6157') {
    const p = this.place(ref, 0, 1);
    const e = worldEndpoints(p);
    return [new Cursor(this.b, e[2]), new Cursor(this.b, e[3])];
  }

  // Trailing turnout: enter by the straight (`from` = 'straight') or the
  // branch end, continue from the common end. Returns a cursor on the other
  // end.
  trail(ref, from = 'straight') {
    const p = this.place(ref, from === 'straight' ? 1 : 2, 0);
    return new Cursor(this.b, worldEndpoints(p)[from === 'straight' ? 2 : 1]);
  }

  buffer() {
    this.place('6116', 0, 1);
    return this;
  }

  ramp(grade) {
    this.grade = grade;
    return this;
  }

  lift(z) {
    this.t.z = z;
    return this;
  }

  fork() {
    const c = new Cursor(this.b, this.t);
    c.grade = this.grade;
    return c;
  }
}

export class Builder {
  constructor(layout) {
    this.layout = layout;
    this.all = [];
  }

  at(x, y, deg = 0, z = 0) {
    return new Cursor(this, { x, y, a: deg * DEG, z });
  }

  from(piece, ep) {
    return new Cursor(this, worldEndpoints(piece)[ep]);
  }

  scenery(kind, x, y, rotDeg = 0, extra = {}) {
    this.layout.scenery.push({ id: newId(this.layout), kind, x, y, rot: rotDeg * DEG, scale: 1, ...extra });
  }

  trees(list, kind = 'tree') {
    for (const [x, y, k] of list) {
      this.scenery(k || kind, x, y, (x * 7 + y * 3) % 360, { scale: 0.8 + ((x + y) % 45) / 100 });
    }
  }

  train(name, consist, piece, s = 50, dir = 1, throttle = 0) {
    const L = this.layout;
    const tr = { id: newId(L), name, consist, trail: [], throttle: 0, speed: 0, reversed: false, shuttle: false };
    if (!placeTrain(L, tr, { pid: piece.id, ri: 0, s, dir })) return null;
    tr.throttle = throttle;
    L.trains.push(tr);
    return tr;
  }

  // Terrain helpers
  hill(x, y, radius, height, steps = 30) {
    const T = this.layout.terrain;
    for (let i = 0; i < steps; i++) applyBrush(T, x, y, { radius, strength: height / steps / 0.9, mode: 'raise' });
  }

  valley(x, y, radius, depth, steps = 20) {
    const T = this.layout.terrain;
    for (let i = 0; i < steps; i++) applyBrush(T, x, y, { radius, strength: depth / steps / 0.9, mode: 'lower' });
  }

  smooth(x, y, radius, n = 3) {
    for (let i = 0; i < n; i++) applyBrush(this.layout.terrain, x, y, { radius, strength: 1, mode: 'smooth' });
  }

  paintAll(fn) {
    const T = this.layout.terrain;
    for (let j = 0; j < T.ny; j++) for (let i = 0; i < T.nx; i++) {
      const k = j * T.nx + i;
      const v = fn(i * T.cell, j * T.cell, T.heights[k]);
      if (v != null) T.paint[k] = v;
    }
  }

  // Default ground cover: grass/meadow patches, rock on heights, sand on shores.
  naturalPaint() {
    this.paintAll((x, y, h) => {
      if (h > 170) return 3;
      if (h < -3) return 4;
      return Math.sin(x * 0.012) + Math.sin(y * 0.016 + x * 0.004) > 0.9 ? 1 : 0;
    });
  }

  // Flatten the terrain under a list of pieces to their height.
  flattenUnder(pieces, radius = 55) {
    const T = this.layout.terrain;
    for (const p of pieces) {
      for (const e of worldEndpoints(p)) {
        applyBrush(T, e.x, e.y, { radius, strength: 3, mode: 'flatten', target: e.z });
      }
    }
  }
}
