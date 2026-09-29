// Procedural 3D models for scenery and rolling stock (units: mm).
// Models are built with +x = length/front, +y = up, and -z = plan +y.

import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
    matCache.set(key, m);
  }
  return m;
}

function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rTop, rBot, h, color, x = 0, y = 0, z = 0, seg = 16, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Gable roof along x: width w (x), depth d (z), ridge height rh, eave at y.
function gableRoof(w, d, rh, color, y, overhang = 6) {
  const shape = new THREE.Shape();
  const hd = d / 2 + overhang;
  shape.moveTo(-hd, 0);
  shape.lineTo(hd, 0);
  shape.lineTo(0, rh);
  shape.lineTo(-hd, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false });
  geo.translate(0, 0, -(w + overhang * 2) / 2);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color));
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function windows(g, w, d, y, h, count, color = '#2d3440') {
  const step = w / (count + 1);
  for (let i = 1; i <= count; i++) {
    for (const side of [1, -1]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(step * 0.45, h), mat(color, { roughness: 0.3 }));
      win.position.set(-w / 2 + i * step, y, side * (d / 2 + 0.3));
      if (side < 0) win.rotation.y = Math.PI;
      g.add(win);
    }
  }
}

// --------------------------------------------------------------- scenery
export function buildScenery(st) {
  const g = new THREE.Group();
  const { w, d, h } = st;
  switch (st.id) {
    case 'station': {
      g.add(box(w, h * 0.62, d, st.color));
      g.add(gableRoof(w, d, h * 0.38, st.roof, h * 0.62));
      g.add(box(w * 0.3, h * 0.45, d * 1.25, st.color, 0, 0, 0));
      g.add(gableRoof(w * 0.3, d * 1.25, h * 0.3, st.roof, h * 0.45).rotateY(0));
      windows(g, w, d, h * 0.35, h * 0.22, 7);
      g.add(box(w * 1.05, 3, 24, '#5d4b3b', 0, h * 0.42, d / 2 + 12));
      break;
    }
    case 'platform':
      g.add(box(w, h, d, st.color));
      g.add(box(w, 0.6, 3, '#e9e6d0', 0, h, d / 2 - 3));
      g.add(box(w, 0.6, 3, '#e9e6d0', 0, h, -d / 2 + 3));
      break;
    case 'engineshed': {
      g.add(box(w, h * 0.7, d, st.color));
      g.add(gableRoof(w, d, h * 0.3, st.roof, h * 0.7));
      const door = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.55, h * 0.6), mat('#1c1c1c'));
      door.position.set(w / 2 + 0.3, h * 0.3, 0);
      door.rotation.y = Math.PI / 2;
      g.add(door);
      windows(g, w, d, h * 0.45, h * 0.18, 6);
      break;
    }
    case 'signalbox':
      g.add(box(w, h * 0.45, d, st.color));
      g.add(box(w * 1.1, h * 0.25, d * 1.15, '#c9b58f', 0, h * 0.45));
      windows(g, w * 1.1, d * 1.15, h * 0.58, h * 0.15, 3, '#39414d');
      g.add(gableRoof(w * 1.1, d * 1.15, h * 0.3, st.roof, h * 0.7));
      break;
    case 'watertower':
      g.add(cyl(w * 0.35, w * 0.4, h * 0.6, st.color));
      g.add(cyl(w * 0.5, w * 0.5, h * 0.25, '#4f4f4f', 0, h * 0.6));
      g.add(cyl(0.5, w * 0.55, h * 0.15, st.roof, 0, h * 0.85));
      break;
    case 'signal': {
      g.add(cyl(1.2, 1.5, h, '#555'));
      const arm = box(24, 3, 1.2, '#c0392b', 12, h * 0.8, 1.5);
      arm.rotation.z = 0.5;
      g.add(arm);
      break;
    }
    case 'house':
      g.add(box(w, h * 0.6, d, st.color));
      g.add(gableRoof(w, d, h * 0.4, st.roof, h * 0.6));
      windows(g, w, d, h * 0.2, h * 0.12, 3);
      windows(g, w, d, h * 0.45, h * 0.12, 3);
      g.add(box(12, 22, 12, '#7a4b3a', w * 0.25, h * 0.75, 0));
      break;
    case 'timbered': {
      g.add(box(w, h * 0.6, d, st.color));
      g.add(gableRoof(w, d, h * 0.4, st.roof, h * 0.6));
      for (let i = 0; i <= 4; i++) {
        for (const side of [1, -1]) {
          const beam = box(2.5, h * 0.6, 1, st.timber, -w / 2 + (i * w) / 4, 0, side * (d / 2 + 0.5));
          g.add(beam);
        }
      }
      for (const side of [1, -1]) {
        g.add(box(w, 2.5, 1, st.timber, 0, h * 0.3, side * (d / 2 + 0.5)));
        g.add(box(w, 2.5, 1, st.timber, 0, h * 0.58, side * (d / 2 + 0.5)));
      }
      windows(g, w, d, h * 0.42, h * 0.1, 2);
      break;
    }
    case 'church': {
      g.add(box(w * 0.8, h * 0.6, d, st.color, -w * 0.1));
      g.add(gableRoof(w * 0.8, d, h * 0.45, st.roof, h * 0.6).translateX(-w * 0.1));
      const tw = 42;
      g.add(box(tw, st.tower * 0.72, tw, st.color, w / 2 - tw / 2));
      const spire = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.72, st.tower * 0.36, 4), mat(st.roof));
      spire.position.set(w / 2 - tw / 2, st.tower * 0.72 + st.tower * 0.18, 0);
      spire.rotation.y = Math.PI / 4;
      spire.castShadow = true;
      g.add(spire);
      windows(g, w * 0.8, d, h * 0.3, h * 0.3, 4, '#3b4a6b');
      break;
    }
    case 'factory': {
      g.add(box(w, h * 0.75, d, st.color));
      // saw-tooth roof
      const n = 4;
      for (let i = 0; i < n; i++) {
        const r = gableRoof(d, w / n, h * 0.25, st.roof, h * 0.75, 0);
        r.rotation.y = 0;
        r.position.x = -w / 2 + (w / n) * (i + 0.5);
        r.rotation.y = Math.PI / 2;
        g.add(r);
      }
      g.add(cyl(9, 13, st.chimney, '#7a3f2e', w / 2 - 20, 0, -d / 2 + 20));
      windows(g, w, d, h * 0.4, h * 0.3, 6, '#39414d');
      break;
    }
    case 'farm':
      g.add(box(w, h * 0.5, d, st.color));
      g.add(gableRoof(w, d, h * 0.5, st.roof, h * 0.5));
      g.add(box(w * 0.25, h * 0.35, 1, '#6e4a2a', 0, 0, d / 2 + 0.6));
      break;
    case 'tree': {
      g.add(cyl(2.5, 3.5, h * 0.4, '#5b4230'));
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(w / 2, 1), mat(st.color, { flatShading: true }));
      c.position.y = h * 0.62;
      c.scale.set(1, 1.25, 1);
      c.castShadow = true;
      g.add(c);
      break;
    }
    case 'conifer': {
      g.add(cyl(2, 3, h * 0.2, '#4a3526'));
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((w / 2) * (1 - i * 0.22), h * 0.42, 9), mat(st.color, { flatShading: true }));
        cone.position.y = h * 0.2 + i * h * 0.22 + h * 0.21;
        cone.castShadow = true;
        g.add(cone);
      }
      break;
    }
    case 'bush': {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(w / 2, 1), mat(st.color, { flatShading: true }));
      b.position.y = h * 0.4;
      b.scale.set(1, h / w * 1.4, 1);
      b.castShadow = true;
      g.add(b);
      break;
    }
    case 'rock': {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(w / 2, 0), mat(st.color, { flatShading: true }));
      r.scale.set(1, h / w * 1.6, d / w);
      r.position.y = h * 0.35;
      r.castShadow = true;
      r.receiveShadow = true;
      g.add(r);
      break;
    }
    case 'road':
      g.add(box(w, 1.2, d, st.color));
      g.add(box(w * 0.9, 0.3, 1.5, '#e8e8e8', 0, 1.2, 0));
      break;
    case 'tunnel': {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.lineTo(-w / 2, 0);
      const hole = new THREE.Path();
      const hw = 24, hh = 62;
      hole.moveTo(-hw, 0); hole.lineTo(hw, 0); hole.lineTo(hw, hh - hw);
      hole.absarc(0, hh - hw, hw, 0, Math.PI, false);
      hole.lineTo(-hw, 0);
      shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
      geo.translate(0, 0, -d / 2);
      geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, mat(st.color, { flatShading: true }));
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hh), mat('#0d0d0d'));
      inside.position.set(-d / 2 + 1, hh / 2, 0);
      inside.rotation.y = Math.PI / 2;
      g.add(inside);
      break;
    }
    case 'car':
      g.add(box(w, h * 0.55, d, st.color, 0, 2));
      g.add(box(w * 0.5, h * 0.4, d * 0.9, '#9fb4c8', -w * 0.05, h * 0.55 + 2));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const wh = cyl(3.5, 3.5, 3, '#111', sx * w * 0.32, 0, sz * d * 0.45, 10);
        wh.rotation.x = Math.PI / 2;
        wh.position.y = 3.5;
        g.add(wh);
      }
      break;
    default:
      g.add(box(w, h, d, st.color || '#999'));
  }
  return g;
}

// --------------------------------------------------------- rolling stock
const W = 30; // body width (HO ≈ 2.9 m)

function bogie(g, x) {
  g.add(box(28, 6, 24, '#262626', x, 0));
  for (const dx of [-7, 7]) {
    for (const s of [-1, 1]) {
      const wh = cyl(5.5, 5.5, 2, '#3a3a3a', x + dx, 0, s * 8.25, 12, { metalness: 0.6 });
      wh.rotation.x = Math.PI / 2;
      wh.position.y = 5.5;
      g.add(wh);
    }
  }
}

function axle(g, x, r = 5.5, color = '#333') {
  for (const s of [-1, 1]) {
    const wh = cyl(r, r, 2.5, color, x, 0, s * 9.5, 14, { metalness: 0.4 });
    wh.rotation.x = Math.PI / 2;
    wh.position.y = r;
    g.add(wh);
  }
}

export function buildStock(st) {
  const g = new THREE.Group();
  const L = st.length - 6;
  const c1 = st.color, c2 = st.color2 || st.color;
  switch (st.style) {
    case 'coach': {
      bogie(g, -L / 2 + 38);
      bogie(g, L / 2 - 38);
      g.add(box(L, 30, W, c1, 0, 10));
      g.add(box(L + 0.4, 9, W + 0.4, c2, 0, 24));
      windows(g, L, W + 0.8, 28, 7, 10, '#1f2630');
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, L, 16, 1, false, 0, Math.PI), mat('#6b6b6b'));
      // upper half-cylinder along x, flattened
      roof.rotation.z = Math.PI / 2;
      roof.scale.set(0.3, 1, 1);
      roof.position.y = 40;
      roof.castShadow = true;
      g.add(roof);
      break;
    }
    case 'electric': {
      bogie(g, -L / 2 + 42);
      bogie(g, L / 2 - 42);
      g.add(box(L, 30, W, c1, 0, 11));
      g.add(box(L * 0.9, 8, W + 0.4, c2, 0, 13));
      g.add(box(L - 16, 5, W - 6, '#4a4a4a', 0, 41));
      for (const sx of [-1, 1]) {
        g.add(box(4, 10, W * 0.9, '#1f2630', sx * (L / 2 - 1.5), 30));
        const panto = box(30, 1.5, 18, '#222', sx * L * 0.22, 50);
        panto.rotation.z = sx * 0.25;
        g.add(panto);
      }
      break;
    }
    case 'diesel-hood': {
      bogie(g, -L / 2 + 36);
      bogie(g, L / 2 - 36);
      g.add(box(L, 5, W, '#2a2a2a', 0, 9));
      g.add(box(L * 0.36, 26, W - 6, c1, -L * 0.3, 14));
      g.add(box(L * 0.36, 26, W - 6, c1, L * 0.3, 14));
      g.add(box(L * 0.22, 32, W, c1, 0, 14));
      g.add(box(L * 0.22 + 0.5, 8, W + 0.5, '#1f2630', 0, 34));
      g.add(box(L, 3, W + 0.5, c2, 0, 14));
      break;
    }
    case 'diesel-shunter': {
      axle(g, -L * 0.28); axle(g, 0); axle(g, L * 0.28);
      g.add(box(L, 5, W, '#2a2a2a', 0, 9));
      g.add(box(L * 0.55, 24, W - 8, c1, L * 0.18, 14));
      g.add(box(L * 0.3, 34, W, c1, -L * 0.3, 14));
      g.add(box(L * 0.3 + 0.5, 8, W + 0.5, '#1f2630', -L * 0.3, 34));
      g.add(box(L * 0.12, 16, W - 10, c1, -L * 0.48, 14));
      break;
    }
    case 'steam-tender':
    case 'steam-tank': {
      const tank = st.style === 'steam-tank';
      const engL = tank ? L : L * 0.62;
      const e0 = L / 2 - engL; // engine rear x
      // frame + wheels
      g.add(box(engL, 5, W - 8, '#1a1a1a', L / 2 - engL / 2, 8));
      const nDrive = tank ? 3 : 4;
      for (let i = 0; i < nDrive; i++) axle(g, L / 2 - engL * 0.3 - i * 17, 8, c2);
      axle(g, L / 2 - 12, 5, c2);
      // boiler
      const bl = engL * 0.66;
      const boiler = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, bl, 20), mat(c1, { metalness: 0.3, roughness: 0.6 }));
      boiler.rotation.z = Math.PI / 2;
      boiler.position.set(L / 2 - bl / 2 - 4, 26, 0);
      boiler.castShadow = true;
      g.add(boiler);
      g.add(cyl(3.5, 4, 12, '#111', L / 2 - 16, 34));
      g.add(cyl(5, 5.5, 7, c1, L / 2 - bl * 0.5, 35));
      g.add(box(8, 18, 20, '#111', L / 2 - 2, 14));
      // cab
      g.add(box(22, 34, W - 2, c1, e0 + 22, 13));
      g.add(box(26, 3, W + 2, '#222', e0 + 22, 47));
      if (tank) {
        for (const s of [-1, 1]) g.add(box(engL * 0.35, 14, 5, c1, L / 2 - engL * 0.45, 16, s * 12.5));
        g.add(box(16, 24, W - 4, c1, e0 + 6, 13));
      } else {
        // tender
        const tl = L - engL - 4;
        g.add(box(tl, 5, W - 6, '#1a1a1a', -L / 2 + tl / 2, 8));
        g.add(box(tl, 26, W, c1, -L / 2 + tl / 2, 12));
        g.add(box(tl * 0.8, 5, W - 8, '#0b0b0b', -L / 2 + tl / 2, 38));
        bogie(g, -L / 2 + tl * 0.25);
        bogie(g, -L / 2 + tl * 0.75);
      }
      break;
    }
    case 'open': {
      axle(g, -L * 0.3); axle(g, L * 0.3);
      g.add(box(L, 4, W, '#262626', 0, 8));
      g.add(box(L, 20, 2, c1, 0, 12, W / 2 - 1));
      g.add(box(L, 20, 2, c1, 0, 12, -W / 2 + 1));
      g.add(box(2, 20, W, c1, L / 2 - 1, 12));
      g.add(box(2, 20, W, c1, -L / 2 + 1, 12));
      g.add(box(L - 4, 6, W - 4, '#2b241d', 0, 12));
      break;
    }
    case 'flat': {
      bogie(g, -L / 2 + 25);
      bogie(g, L / 2 - 25);
      g.add(box(L, 5, W, c1, 0, 11));
      g.add(box(8, 10, W, '#3b2c20', -L * 0.25, 16));
      g.add(box(8, 10, W, '#3b2c20', L * 0.25, 16));
      // a few logs
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, L * 0.8, 8), mat('#7a5a3a'));
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 30, -9 + i * 9);
        log.castShadow = true;
        g.add(log);
      }
      break;
    }
    default:
      g.add(box(L, 30, W, c1, 0, 10));
  }
  // buffers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const b = cyl(1.6, 1.6, 4, '#222', sx * (L / 2 + 2), 10, sz * 10, 8);
    b.rotation.z = Math.PI / 2;
    b.position.y = 12;
    g.add(b);
  }
  return g;
}
