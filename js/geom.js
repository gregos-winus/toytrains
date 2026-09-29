// Basic 2D geometry helpers. Units are millimetres, angles are radians
// (counter-clockwise, 0 = +x).

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export function normAngle(a) {
  a %= TAU;
  if (a <= -Math.PI) a += TAU;
  if (a > Math.PI) a -= TAU;
  return a;
}

export function angleDiff(a, b) {
  return Math.abs(normAngle(a - b));
}

export function rotate(x, y, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

// Apply a placement transform {x, y, rot} to a local point.
export function toWorld(t, p) {
  const r = rotate(p.x, p.y, t.rot);
  return { x: r.x + t.x, y: r.y + t.y };
}

export function toLocal(t, p) {
  return rotate(p.x - t.x, p.y - t.y, -t.rot);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Distance from point p to segment ab.
export function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ---------------------------------------------------------------------------
// Paths: a path is a start pose plus a list of segments.
//   { type: 'line', len }            straight segment
//   { type: 'arc', r, angle }        arc, angle > 0 turns left, < 0 right
// ---------------------------------------------------------------------------

export function segLength(seg) {
  return seg.type === 'line' ? seg.len : Math.abs(seg.angle) * seg.r;
}

export function pathLength(segs) {
  return segs.reduce((s, g) => s + segLength(g), 0);
}

// Pose after travelling `d` along a single segment from pose p.
export function advanceSeg(p, seg, d) {
  if (seg.type === 'line') {
    return { x: p.x + Math.cos(p.a) * d, y: p.y + Math.sin(p.a) * d, a: p.a };
  }
  const sign = Math.sign(seg.angle);
  const th = (d / seg.r) * sign;
  // centre of the arc is to the left (sign>0) or right (sign<0)
  const cx = p.x - Math.sin(p.a) * seg.r * sign;
  const cy = p.y + Math.cos(p.a) * seg.r * sign;
  const a2 = p.a + th;
  return {
    x: cx + Math.sin(a2) * seg.r * sign,
    y: cy - Math.cos(a2) * seg.r * sign,
    a: a2,
  };
}

// Pose at distance d along a path starting at pose start.
export function poseAt(start, segs, d) {
  let p = { ...start };
  let rem = d;
  for (let i = 0; i < segs.length; i++) {
    const L = segLength(segs[i]);
    if (rem <= L || i === segs.length - 1) {
      return advanceSeg(p, segs[i], Math.min(rem, L));
    }
    p = advanceSeg(p, segs[i], L);
    rem -= L;
  }
  return p;
}

export function pathEnd(start, segs) {
  return poseAt(start, segs, pathLength(segs));
}

// Sample a path every `step` mm (always includes both ends).
export function samplePath(start, segs, step = 10) {
  const L = pathLength(segs);
  const n = Math.max(1, Math.ceil(L / step));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(poseAt(start, segs, (L * i) / n));
  return pts;
}
