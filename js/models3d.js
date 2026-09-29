// Procedural 3D models for scenery and rolling stock (units: mm).
// Models are built with +x = length/front, +y = up, and -z = plan +y.

import * as THREE from 'three';
import * as TX from './textures.js';

// ------------------------------------------------------------ helpers
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v))}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
    matCache.set(key, m);
  }
  return m;
}

function shade(mesh, cast = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

// Scale BoxGeometry UVs so that one texture tile covers su x sv millimetres.
function boxUV(geo, w, h, d, su, sv = su) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * fu / su, uv.getY(i) * fv / sv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

// Remap the u range of one BoxGeometry face (0..5) to [u0, u1].
function faceURange(geo, face, u0, u1) {
  const uv = geo.attributes.uv;
  for (let k = 0; k < 4; k++) {
    const i = face * 4 + k;
    uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
  }
}

// Box standing on y = y0, centred on x/z.
function box(w, h, d, material, x = 0, y = 0, z = 0, uvUnit = null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (uvUnit) boxUV(geo, w, h, d, uvUnit[0], uvUnit[1] ?? uvUnit[0]);
  const m = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y + h / 2, z);
  return shade(m);
}

// Walls with windows repeating every `bay` mm, `storey` mm high.
function facadeBox(w, h, d, tex, bay = 30, storey = 34, x = 0, y = 0, z = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const nW = Math.max(1, Math.round(w / bay)), nD = Math.max(1, Math.round(d / bay));
  const uv = geo.attributes.uv;
  const faces = [[nD, h / storey], [nD, h / storey], [1, 1], [1, 1], [nW, h / storey], [nW, h / storey]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * faces[f][0], uv.getY(i) * faces[f][1]);
  }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.position.set(x, y + h / 2, z);
  return shade(m);
}

function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y + h / 2, z);
  return shade(m);
}

// Horizontal cylinder along x.
function hcyl(r, len, material, x, y, z = 0, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), typeof material === 'string' ? mat(material) : material);
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  return shade(m);
}

// Gable roof along x: length w, depth d, ridge height rh above eave y.
function gableRoof(w, d, rh, tex, y, overhang = 6, color = '#ffffff') {
  const shape = new THREE.Shape();
  const hd = d / 2 + overhang;
  shape.moveTo(-hd, -1.5);
  shape.lineTo(hd, -1.5);
  shape.lineTo(0, rh);
  shape.lineTo(-hd, -1.5);
  const L = w + overhang * 2;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
  geo.translate(0, 0, -L / 2);
  geo.rotateY(Math.PI / 2);
  const material = tex
    ? new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.85 })
    : mat(color);
  if (tex) {
    // world-ish UVs: extrude UVs are in mm, 1 tile = 40 mm
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 40, uv.getY(i) / 40);
  }
  const m = new THREE.Mesh(geo, material);
  m.position.y = y;
  return shade(m);
}

// Gable-end triangles (walls under the roof).
function gableEnds(w, d, rh, material, y) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, rh * 0.96); shape.lineTo(-d / 2, 0);
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const geo = new THREE.ShapeGeometry(shape);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 30, uv.getY(i) / 34);
    const m = new THREE.Mesh(geo, material);
    m.rotation.y = sx * Math.PI / 2;
    m.position.set(sx * w / 2, y, 0);
    g.add(shade(m, false));
  }
  return g;
}

function decal(tex, w, h, x, y, z, rotY = 0, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: !!opts.transparent, ...opts }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  return m;
}

function chimney(x, y, z, h = 18) {
  const g = new THREE.Group();
  g.add(box(9, h, 9, new THREE.MeshStandardMaterial({ map: TX.brick('#8b3a2a') }), x, y, z, [16, 8]));
  g.add(box(11, 2, 11, '#555', x, y + h, z));
  return g;
}

// ------------------------------------------------------------ scenery
export function buildScenery(st) {
  const g = new THREE.Group();
  const { w, d, h } = st;
  switch (st.model || st.id) {
    case 'station': {
      const wall = TX.facade('plaster', st.color, { shutters: null, frame: '#f5efe2' });
      const eave = h * 0.62;
      g.add(box(w + 4, 6, d + 4, new THREE.MeshStandardMaterial({ map: TX.stone('#9b958a') }), 0, 0, 0, [40, 20]));
      g.add(facadeBox(w, eave - 6, d, wall, 30, 34, 0, 6));
      g.add(gableRoof(w, d, h * 0.38, TX.roofTiles(st.roof), eave));
      g.add(gableEnds(w, d, h * 0.38, new THREE.MeshStandardMaterial({ map: wall }), eave));
      // central risalit
      g.add(facadeBox(w * 0.28, eave + 10, d + 14, TX.facade('plaster', '#e4d3b0', { tall: true }), 34, eave + 10, 0, 0));
      const r2 = gableRoof(d + 14, w * 0.28, h * 0.3, TX.roofTiles(st.roof), eave + 10);
      r2.rotation.y = Math.PI / 2;
      g.add(r2);
      // clock and name board on the track side (+z = plan -y)
      g.add(decal(TX.clockTex(), 18, 18, 0, eave + 20, d / 2 + 7.2, 0, { transparent: true }));
      g.add(decal(TX.signTex('BAHNHOF'), 70, 12, -w * 0.3, eave - 12, d / 2 + 0.4));
      g.add(decal(TX.doorTex('#5a3a22', true), 16, 30, 0, 21, d / 2 + 7.2));
      // platform canopy on columns
      const canopy = box(w * 0.9, 2.5, 34, new THREE.MeshStandardMaterial({ map: TX.planks('#6d5a45'), roughness: 0.9 }), 0, eave - 22, d / 2 + 17, [30]);
      canopy.rotation.x = -0.12;
      g.add(canopy);
      for (let i = 0; i < 6; i++) g.add(cyl(1.2, 1.2, eave - 22, '#3a4a3a', -w * 0.42 + i * (w * 0.84 / 5), 0, d / 2 + 30, 8));
      break;
    }
    case 'platform': {
      g.add(box(w, h, d, new THREE.MeshStandardMaterial({ map: TX.concrete() }), 0, 0, 0, [60]));
      g.add(box(w, 0.4, 3, '#f1ebc9', 0, h, d / 2 - 3.5));
      g.add(box(w, 0.4, 3, '#f1ebc9', 0, h, -d / 2 + 3.5));
      for (let i = 0; i < 3; i++) {
        const x = -w / 2 + w * (i + 0.5) / 3;
        g.add(cyl(0.9, 1.1, 48, '#2c3a2c', x, h, 0, 8));
        g.add(box(10, 2, 3, '#2c3a2c', x, h + 46, 0));
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#ffe9a8', emissiveIntensity: 0.6 }));
        lamp.position.set(x, h + 45, 0);
        g.add(lamp);
      }
      g.add(box(22, 4, 7, new THREE.MeshStandardMaterial({ map: TX.planks('#6b4a2c') }), w * 0.2, h + 4, 0, [20]));
      g.add(box(2, 4, 2, '#333', w * 0.2 - 9, h, 0));
      g.add(box(2, 4, 2, '#333', w * 0.2 + 9, h, 0));
      g.add(decal(TX.signTex('2', '#1d3f73'), 8, 8, -w * 0.3, h + 40, 0.5));
      break;
    }
    case 'engineshed': {
      const brickTex = TX.facade('brick', st.color, { tall: true, frame: '#d9cfb8' });
      g.add(facadeBox(w, h * 0.7, d, brickTex, 36, h * 0.7));
      g.add(gableRoof(w, d, h * 0.3, TX.roofTiles('#5a5a5a'), h * 0.7, 4, '#bbbbbb'));
      g.add(gableEnds(w, d, h * 0.3, new THREE.MeshStandardMaterial({ map: TX.brick(st.color) }), h * 0.7));
      // doors at both ends
      for (const sx of [1, -1]) {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(46, h * 0.6), new THREE.MeshStandardMaterial({ map: TX.planks('#3e5a44'), roughness: 0.9 }));
        door.position.set(sx * (w / 2 + 0.4), h * 0.3, 0);
        door.rotation.y = sx * Math.PI / 2;
        g.add(door);
      }
      for (let i = 0; i < 3; i++) g.add(box(14, 12, 10, '#444', -w * 0.3 + i * w * 0.3, h * 0.95, 0));
      break;
    }
    case 'signalbox': {
      g.add(box(w, h * 0.45, d, new THREE.MeshStandardMaterial({ map: TX.brick(st.color) }), 0, 0, 0, [20, 10]));
      const upper = TX.facade('plaster', '#c9b58f', { frame: '#ffffff' });
      g.add(facadeBox(w * 1.1, h * 0.26, d * 1.15, upper, 16, h * 0.26, 0, h * 0.45));
      g.add(gableRoof(w * 1.1, d * 1.15, h * 0.28, TX.roofTiles(st.roof), h * 0.71, 7));
      g.add(gableEnds(w * 1.1, d * 1.15, h * 0.28, mat('#c9b58f'), h * 0.71));
      g.add(decal(TX.signTex('Wf', '#ffffff', '#111', 64, 32), 12, 6, 0, h * 0.4, d / 2 + 0.3));
      // stairs
      for (let i = 0; i < 8; i++) g.add(box(10, 2, 4, '#555', w / 2 + 6, i * (h * 0.45 / 8), -d / 2 + 2 + i * 4));
      break;
    }
    case 'watertower': {
      g.add(cyl(w * 0.34, w * 0.4, h * 0.58, new THREE.MeshStandardMaterial({ map: TX.brick(st.color) })));
      g.add(cyl(w * 0.52, w * 0.52, h * 0.26, new THREE.MeshStandardMaterial({ map: TX.planks('#4f4f4f'), metalness: 0.3 }), 0, h * 0.58, 0, 24));
      g.add(cyl(w * 0.54, w * 0.54, 2, '#333', 0, h * 0.58, 0, 24));
      g.add(cyl(1, w * 0.58, h * 0.16, new THREE.MeshStandardMaterial({ map: TX.roofTiles('#555') }), 0, h * 0.84, 0, 24));
      // water crane arm
      const arm = hcyl(2, 40, '#333', w * 0.6, h * 0.62);
      g.add(arm);
      break;
    }
    case 'signal': {
      g.add(cyl(1.2, 1.6, h, '#6b6b6b', 0, 0, 0, 8));
      const armG = new THREE.Group();
      armG.position.set(0, h * 0.82, 1.6);
      const arm = box(26, 3.5, 0.8, '#c0392b', 13, -1.75, 0);
      arm.rotation.z = 0.78;
      armG.add(arm);
      const tip = box(6, 3.6, 0.9, '#f2f2f2', 20, -1.8, 0.1);
      tip.rotation.z = 0.78;
      armG.add(tip);
      g.add(armG);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), new THREE.MeshStandardMaterial({ color: '#8cff9c', emissive: '#40ff60', emissiveIntensity: 1.2 }));
      lamp.position.set(0, h * 0.72, 2);
      g.add(lamp);
      for (let i = 0; i < 14; i++) g.add(box(4, 0.5, 0.5, '#555', 0, 4 + i * (h * 0.7 / 14), -2));
      break;
    }
    case 'house': {
      const wall = TX.facade('plaster', st.color, { shutters: '#3d6b4a' });
      g.add(facadeBox(w, h * 0.6, d, wall, 30, h * 0.3));
      g.add(gableRoof(w, d, h * 0.4, TX.roofTiles(st.roof), h * 0.6));
      g.add(gableEnds(w, d, h * 0.4, new THREE.MeshStandardMaterial({ map: TX.facade('plaster', st.color, { window: false }) }), h * 0.6));
      g.add(decal(TX.doorTex('#6b3f26'), 14, 26, 0, 13, d / 2 + 0.5));
      g.add(chimney(w * 0.25, h * 0.72, 0));
      break;
    }
    case 'townhouse': {
      const wall = TX.facade('plaster', st.color, { frame: '#ffffff' });
      g.add(box(w, h * 0.3, d, new THREE.MeshStandardMaterial({ map: TX.facade('plaster', '#e9e1cf', { window: false }) }), 0, 0, 0, [w, h * 0.3]));
      g.add(decal(TX.shopFront(st.shop || '#2f5d3a', st.label || 'BÄCKEREI'), w * 0.92, h * 0.28, 0, h * 0.14, d / 2 + 0.4));
      g.add(facadeBox(w, h * 0.55, d, wall, 28, h * 0.275, 0, h * 0.3));
      g.add(box(w + 4, 3, d + 4, '#d8d0c0', 0, h * 0.85));
      g.add(gableRoof(w, d, h * 0.25, TX.roofTiles(st.roof), h * 0.88, 3));
      g.add(gableEnds(w, d, h * 0.25, mat(st.color), h * 0.88));
      g.add(chimney(-w * 0.3, h * 0.95, 0, 14));
      break;
    }
    case 'timbered': {
      const wall = TX.facade('timber', st.color, { timber: st.timber, frame: '#f1e9d8' });
      g.add(box(w, 8, d, new THREE.MeshStandardMaterial({ map: TX.stone('#9c9485') }), 0, 0, 0, [40, 20]));
      g.add(facadeBox(w, h * 0.55, d, wall, 30, h * 0.275, 0, 8));
      g.add(gableRoof(w, d, h * 0.42, TX.roofTiles(st.roof), h * 0.55 + 8));
      g.add(gableEnds(w, d, h * 0.42, new THREE.MeshStandardMaterial({ map: TX.facade('timber', st.color, { timber: st.timber, window: false }) }), h * 0.55 + 8));
      g.add(decal(TX.doorTex('#4a2c1c'), 13, 24, w * 0.2, 20, d / 2 + 0.5));
      g.add(chimney(-w * 0.2, h * 0.8, 0));
      break;
    }
    case 'church': {
      const stoneTex = TX.stone('#cfc6b3');
      const nave = TX.facade('plaster', st.color, { tall: true, frame: '#bdb3a0' });
      g.add(facadeBox(w * 0.8, h * 0.6, d, nave, 36, h * 0.6, -w * 0.1));
      g.add(gableRoof(w * 0.8, d, h * 0.45, TX.roofTiles(st.roof), h * 0.6, 5, '#aab'));
      g.add(gableEnds(w * 0.8, d, h * 0.45, mat(st.color), h * 0.6).translateX(-w * 0.1));
      const tw = 44;
      const tx = w / 2 - tw / 2;
      g.add(box(tw, st.tower * 0.7, tw, new THREE.MeshStandardMaterial({ map: stoneTex }), tx, 0, 0, [50, 25]));
      for (const [rx, rz, ry] of [[tx + tw / 2 + 0.3, 0, Math.PI / 2], [tx - tw / 2 - 0.3, 0, -Math.PI / 2], [tx, tw / 2 + 0.3, 0], [tx, -tw / 2 - 0.3, Math.PI]]) {
        g.add(decal(TX.clockTex(), 18, 18, rx, st.tower * 0.58, rz, ry, { transparent: true }));
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.74, st.tower * 0.36, 4), new THREE.MeshStandardMaterial({ map: TX.roofTiles(st.roof), color: '#aab' }));
      spire.position.set(tx, st.tower * 0.7 + st.tower * 0.18, 0);
      spire.rotation.y = Math.PI / 4;
      g.add(shade(spire));
      g.add(cyl(0.6, 0.6, 16, '#c9a33a', tx, st.tower * 0.88 + 2, 0, 6));
      g.add(box(8, 1, 1, '#c9a33a', tx, st.tower * 0.88 + 12, 0));
      break;
    }
    case 'factory': {
      const wall = TX.facade('brick', st.color, { tall: true, frame: '#cfc4ad' });
      g.add(facadeBox(w, h * 0.75, d, wall, 32, h * 0.75));
      const n = 4;
      for (let i = 0; i < n; i++) {
        // saw-tooth roof: one steep glazed face, one tiled
        const shape = new THREE.Shape();
        const s = w / n;
        shape.moveTo(-s / 2, 0); shape.lineTo(s / 2, 0); shape.lineTo(s / 2, h * 0.25); shape.lineTo(-s / 2, 0);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
        geo.translate(0, 0, -d / 2);
        const m = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: '#9fb6c8', roughness: 0.2, metalness: 0.4 })]);
        m.position.set(-w / 2 + s * (i + 0.5), h * 0.75, 0);
        g.add(shade(m));
      }
      const ch = cyl(10, 15, st.chimney, new THREE.MeshStandardMaterial({ map: TX.brick('#7a3f2e') }), w / 2 - 22, 0, -d / 2 + 22, 20);
      g.add(ch);
      for (let i = 1; i < 4; i++) g.add(cyl(12 - i, 12 - i, 3, '#3a2a22', w / 2 - 22, st.chimney * i / 4, -d / 2 + 22, 20));
      g.add(decal(TX.signTex('MASCHINENFABRIK', '#2d2d2d', '#e8d9a8', 512, 48), w * 0.7, 10, 0, h * 0.68, d / 2 + 0.5));
      g.add(decal(TX.planks('#3e5a44'), 40, 50, -w * 0.3, 25, d / 2 + 0.5));
      break;
    }
    case 'farm': {
      g.add(box(w, h * 0.5, d, new THREE.MeshStandardMaterial({ map: TX.planks(st.color) }), 0, 0, 0, [60]));
      g.add(gableRoof(w, d, h * 0.5, TX.roofTiles(st.roof), h * 0.5));
      g.add(gableEnds(w, d, h * 0.5, new THREE.MeshStandardMaterial({ map: TX.planks(st.color) }), h * 0.5));
      g.add(decal(TX.planks('#5b3a22'), w * 0.3, h * 0.42, 0, h * 0.21, d / 2 + 0.6));
      // hay bales
      for (let i = 0; i < 3; i++) {
        const b = hcyl(7, 12, '#d8bf6a', -w * 0.35 + i * 16, 7, d / 2 + 16, 12);
        b.rotation.y = Math.PI / 2;
        g.add(b);
      }
      break;
    }
    case 'tree': {
      g.add(cyl(2.2, 4, h * 0.45, new THREE.MeshStandardMaterial({ map: TX.bark() })));
      const leafMat = new THREE.MeshStandardMaterial({ map: TX.leaves(st.color), roughness: 0.95 });
      const R = TX.rng(Math.round(w * 13 + h));
      for (let i = 0; i < 7; i++) {
        const r = (w / 2) * (0.45 + R() * 0.35);
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
        blob.position.set((R() - 0.5) * w * 0.5, h * 0.5 + R() * h * 0.35, (R() - 0.5) * w * 0.5);
        blob.scale.set(1, 0.85 + R() * 0.3, 1);
        g.add(shade(blob));
      }
      break;
    }
    case 'conifer': {
      g.add(cyl(1.5, 3, h * 0.2, new THREE.MeshStandardMaterial({ map: TX.bark() })));
      const leafMat = new THREE.MeshStandardMaterial({ map: TX.leaves(st.color, 44), roughness: 0.95 });
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const t = i / layers;
        const cone = new THREE.Mesh(new THREE.ConeGeometry((w / 2) * (1 - t * 0.75), h * 0.32, 10), leafMat);
        cone.position.y = h * 0.15 + t * h * 0.68 + h * 0.16;
        cone.rotation.y = i;
        g.add(shade(cone));
      }
      break;
    }
    case 'bush': {
      const leafMat = new THREE.MeshStandardMaterial({ map: TX.leaves(st.color, 45), roughness: 0.95 });
      const R = TX.rng(7);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(w * (0.3 + R() * 0.15), 1), leafMat);
        b.position.set((R() - 0.5) * w * 0.5, h * 0.35, (R() - 0.5) * w * 0.5);
        b.scale.y = 0.75;
        g.add(shade(b));
      }
      break;
    }
    case 'rock': {
      const geo = new THREE.IcosahedronGeometry(w / 2, 2);
      const pos = geo.attributes.position;
      const R = TX.rng(99);
      for (let i = 0; i < pos.count; i++) {
        const k = 0.78 + R() * 0.35;
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
      }
      geo.computeVertexNormals();
      const r = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: TX.rockTex(), color: st.color, flatShading: true, roughness: 1 }));
      r.scale.set(1, h / w * 1.6, d / w);
      r.position.y = h * 0.3;
      g.add(shade(r));
      break;
    }
    case 'road': {
      g.add(box(w, 1.2, d, new THREE.MeshStandardMaterial({ map: TX.asphalt() }), 0, 0, 0, [80]));
      for (let x = -w / 2 + 8; x < w / 2 - 8; x += 26) g.add(box(14, 0.2, 1.5, '#eeeeee', x + 7, 1.2, 0));
      g.add(box(w, 0.2, 1.2, '#dddddd', 0, 1.2, d / 2 - 3));
      g.add(box(w, 0.2, 1.2, '#dddddd', 0, 1.2, -d / 2 + 3));
      break;
    }
    case 'tunnel':
      g.add(buildPortal(h, h, d));
      break;
    case 'car': {
      const body = st.color;
      g.add(box(w, h * 0.42, d, mat(body, { metalness: 0.4, roughness: 0.35 }), 0, 3.5));
      const cabin = box(w * 0.52, h * 0.36, d * 0.9, new THREE.MeshStandardMaterial({ color: '#29394a', roughness: 0.15, metalness: 0.5 }), -w * 0.05, 3.5 + h * 0.42);
      g.add(cabin);
      g.add(box(w * 0.5, 0.8, d * 0.88, mat(body, { metalness: 0.4, roughness: 0.35 }), -w * 0.05, 3.5 + h * 0.78));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const wh = cyl(3.5, 3.5, 3, new THREE.MeshStandardMaterial({ color: '#111' }), sx * w * 0.32, 0, sz * d * 0.45, 12);
        wh.rotation.x = Math.PI / 2;
        wh.position.y = 3.5;
        g.add(wh);
      }
      for (const sz of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff8e0', emissiveIntensity: 0.5 }));
        l.position.set(w / 2, 6, sz * d * 0.32);
        g.add(l);
      }
      break;
    }
    case 'lamp': {
      g.add(cyl(0.8, 1.2, h, '#2c3a2c', 0, 0, 0, 8));
      g.add(box(10, 1.5, 2, '#2c3a2c', 4, h - 1.5, 0));
      const l = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#ffe9a8', emissiveIntensity: 0.8 }));
      l.position.set(8, h - 3, 0);
      g.add(l);
      break;
    }
    case 'fence': {
      const wood = new THREE.MeshStandardMaterial({ map: TX.planks('#8a6a45') });
      for (let x = -w / 2; x <= w / 2; x += 12) g.add(box(1.5, h, 1.5, wood, x, 0, 0));
      g.add(box(w, 1.5, 1, wood, 0, h * 0.35, 0));
      g.add(box(w, 1.5, 1, wood, 0, h * 0.75, 0));
      break;
    }
    case 'people': {
      const R = TX.rng(5);
      const colors = ['#2f4f7f', '#8b2d2d', '#3d6b4a', '#6b5a2d', '#555', '#9b6ba8'];
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Group();
        const c = colors[i % colors.length];
        p.add(cyl(1.4, 1.8, 11, mat(c), 0, 8));
        p.add(cyl(0.8, 0.8, 8, mat('#333'), -0.8, 0));
        p.add(cyl(0.8, 0.8, 8, mat('#333'), 0.8, 0));
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), mat('#e0b594'));
        head.position.y = 20.5;
        p.add(head);
        p.position.set((R() - 0.5) * w, 0, (R() - 0.5) * d);
        p.rotation.y = R() * 6;
        g.add(p);
      }
      break;
    }
    default:
      g.add(box(w, h, d, st.color || '#999'));
  }
  return g;
}

// Tunnel portal: stone head wall with an arched opening for one track,
// pilasters, a cornice and wing walls. The arch axis is along x.
export function buildPortal(height = 120, _h = 100, width = 150, holes = [0]) {
  const g = new THREE.Group();
  const T = 18;
  const hw = 27, hh = 78;
  // outline with the arches cut out of the bottom edge (shape x = plan left)
  const shape = new THREE.Shape();
  const xs = [...holes].sort((p, q) => p - q);
  shape.moveTo(-width / 2, 0);
  for (const hx of xs) {
    shape.lineTo(hx - hw, 0);
    shape.lineTo(hx - hw, hh - hw);
    shape.absarc(hx, hh - hw, hw, Math.PI, 0, true);
    shape.lineTo(hx + hw, 0);
  }
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.lineTo(-width / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 16 });
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 60, uv.getY(i) / 60);
  geo.translate(0, 0, -T / 2);
  geo.rotateY(Math.PI / 2);
  const stoneMat = new THREE.MeshStandardMaterial({ map: TX.stone('#9a9489'), roughness: 0.95 });
  const wall = shade(new THREE.Mesh(geo, stoneMat));
  g.add(wall);
  // arch voussoirs rings and dark mouths
  for (const off of holes) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(hw + 3, 3.2, 6, 20, Math.PI), mat('#7f7a70'));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(T / 2 + 0.5, hh - hw, -off);
    g.add(shade(ring));
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hh), new THREE.MeshBasicMaterial({ color: '#050505' }));
    inner.position.set(-60, hh / 2, -off);
    inner.rotation.y = Math.PI / 2;
    g.add(inner);
  }
  // cornice and pilasters
  g.add(box(T + 6, 6, width + 8, mat('#8a857b'), 0, height - 2, 0));
  for (const s of [-1, 1]) g.add(box(T + 4, height, 12, stoneMat, 0, 0, s * (width / 2 - 6), [30, 30]));
  // wing walls angled away from the tunnel
  for (const s of [-1, 1]) {
    const wing = box(70, height * 0.7, 10, stoneMat, 32, 0, s * (width / 2 + 16), [30, 30]);
    wing.rotation.y = -s * 0.5;
    g.add(wing);
  }
  return g;
}

// ------------------------------------------------------------ rolling stock
const W = 32;       // body width
const RAIL_GAUGE_HALF = 8.25;

function wheelset(g, ud, x, r, faceTex, treadColor = '#3a3a3a', widthZ = RAIL_GAUGE_HALF + 1.2) {
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.4, roughness: 0.5 });
  const tread = mat(treadColor, { metalness: 0.7, roughness: 0.35 });
  const pivot = new THREE.Group();
  pivot.position.set(x, r, 0);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.2, 24), [tread, faceMat, faceMat]);
    m.rotation.x = Math.PI / 2;
    m.position.z = s * widthZ;
    pivot.add(shade(m));
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, widthZ * 2, 8), mat('#555'));
  axle.rotation.x = Math.PI / 2;
  pivot.add(axle);
  g.add(pivot);
  ud.wheels.push({ obj: pivot, r });
  return pivot;
}

function bogie(g, ud, x, axles = 2, spacing = 25, r = 5.3) {
  const b = new THREE.Group();
  b.position.x = x;
  const frameMat = mat('#262626', { roughness: 0.7 });
  const len = spacing * (axles - 1) + 16;
  for (const s of [-1, 1]) {
    b.add(box(len, 5, 1.6, frameMat, 0, r - 1.5, s * (RAIL_GAUGE_HALF + 3.5)));
    for (let i = 0; i < axles; i++) {
      const ax = -spacing * (axles - 1) / 2 + i * spacing;
      b.add(box(6, 3, 1.8, '#1b1b1b', ax, r + 1, s * (RAIL_GAUGE_HALF + 3.7)));
      const spring = cyl(1.4, 1.4, 3.5, '#444', ax - 4, r + 1.5, s * (RAIL_GAUGE_HALF + 4.2), 8);
      b.add(spring);
    }
  }
  b.add(box(10, 3, W - 8, frameMat, 0, r + 1.5, 0));
  for (let i = 0; i < axles; i++) wheelset(b, ud, -spacing * (axles - 1) / 2 + i * spacing, r, TX.discWheel());
  g.add(b);
  return b;
}

function buffersAndCouplers(g, L, y = 10) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(hcyl(1.3, 4, '#222', sx * (L / 2 + 2), y, sz * 10.5, 8));
      g.add(hcyl(2.4, 0.8, '#333', sx * (L / 2 + 4.2), y, sz * 10.5, 12));
    }
    g.add(box(3, 3, 3, '#222', sx * (L / 2 + 2.5), y - 3.5, 0));
    g.add(box(4, 1.5, W - 2, '#1a1a1a', sx * (L / 2 - 1), y - 3, 0));
  }
}

function lights(g, ud, L, y, zs = [-9, 9], topY = null) {
  for (const sx of [1, -1]) {
    const matL = new THREE.MeshStandardMaterial({ color: '#dddddd', emissive: '#000000', emissiveIntensity: 1.5 });
    const list = [];
    for (const z of zs) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 10), matL);
      l.rotation.z = Math.PI / 2;
      l.position.set(sx * (L / 2 + 0.3), y, z);
      g.add(l);
      list.push(l);
    }
    if (topY != null) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 10), matL);
      l.rotation.z = Math.PI / 2;
      l.position.set(sx * (L / 2 + 0.3), topY, 0);
      g.add(l);
    }
    if (sx > 0) ud.lightFront = matL; else ud.lightRear = matL;
  }
}

// Side livery panels on both sides of a box body.
function liveryPanels(g, st, L, h, y, zHalf) {
  const tex = TX.liverySide(st, L, h);
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.1 });
  const back = front.clone();
  back.map = tex.clone();
  back.map.wrapS = THREE.RepeatWrapping;
  back.map.repeat.x = -1;
  back.map.offset.x = 1;
  back.map.needsUpdate = true;
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(L, h), front);
  p1.position.set(0, y + h / 2, zHalf + 0.25);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(L, h), back);
  p2.position.set(0, y + h / 2, -zHalf - 0.25);
  p2.rotation.y = Math.PI;
  g.add(p1, p2);
}

function roofProfile(L, width, rise, color, y) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.quadraticCurveTo(-width / 2 + 1, rise * 0.8, -width / 4, rise * 0.97);
  shape.quadraticCurveTo(0, rise * 1.02, width / 4, rise * 0.97);
  shape.quadraticCurveTo(width / 2 - 1, rise * 0.8, width / 2, 0);
  shape.lineTo(-width / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -L / 2);
  geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color, { roughness: 0.6 }));
  m.position.y = y;
  return shade(m);
}

function pantograph(g, x, y) {
  const p = new THREE.Group();
  p.position.set(x, y, 0);
  const pm = mat('#2b2b2b', { metalness: 0.6 });
  p.add(box(22, 1, 16, pm, 0, 0, 0));
  for (const s of [-1, 1]) {
    const a = hcyl(0.6, 22, pm, -4, 8, s * 5, 6);
    a.rotation.set(0, 0, Math.PI / 2 + 0.55);
    p.add(a);
    const b = hcyl(0.6, 18, pm, 4, 15, s * 5, 6);
    b.rotation.set(0, 0, Math.PI / 2 - 0.6);
    p.add(b);
  }
  p.add(box(3, 1, 24, '#999', 0, 20, 0));
  p.add(box(1, 1.5, 24, '#555', 0, 21, 0));
  for (const s of [-1, 1]) g.add(cyl(1.2, 1.2, 4, '#c8b89a', x + s * 8, y - 4, 6, 8));
  g.add(p);
}

export function buildStock(st) {
  const g = new THREE.Group();
  const ud = { wheels: [], rods: [], chimney: null, lightFront: null, lightRear: null, kind: st.kind };
  g.userData = ud;
  const L = st.length - 8; // body length (without buffers)
  const c1 = st.color, c2 = st.color2 || st.color;
  switch (st.style) {
    case 'coach': {
      const floor = 12, bodyH = 30;
      bogie(g, ud, -L / 2 + 40, 2, 25);
      bogie(g, ud, L / 2 - 40, 2, 25);
      g.add(box(L - 6, 3, W - 6, '#1d1d1d', 0, floor - 3));
      // underframe equipment
      g.add(box(40, 6, 14, '#2a2a2a', -20, floor - 8, 4));
      g.add(box(22, 5, 10, '#303030', 30, floor - 7, -6));
      g.add(box(L, bodyH, W, mat(c1, { roughness: 0.45 }), 0, floor));
      liveryPanels(g, st, L, bodyH, floor, W / 2);
      g.add(roofProfile(L, W, 6.5, '#6f6f6f', floor + bodyH));
      for (let i = 0; i < 8; i++) g.add(cyl(1.6, 2, 2.2, '#5a5a5a', -L / 2 + 30 + i * (L - 60) / 7, floor + bodyH + 5.5, 0, 8));
      // gangways
      for (const sx of [-1, 1]) g.add(box(3, bodyH - 6, 20, '#1f1f1f', sx * (L / 2 + 1.2), floor + 2));
      buffersAndCouplers(g, L, 10);
      break;
    }
    case 'electric': {
      const floor = 13, bodyH = 30;
      bogie(g, ud, -L / 2 + 44, 3, 17, 7.2);
      bogie(g, ud, L / 2 - 44, 3, 17, 7.2);
      g.add(box(L - 4, 5, W - 2, '#222', 0, floor - 4));
      // body with sloped noses
      const bodyShape = new THREE.Shape();
      const nose = 16;
      bodyShape.moveTo(-L / 2, 0);
      bodyShape.lineTo(L / 2, 0);
      bodyShape.lineTo(L / 2, bodyH * 0.5);
      bodyShape.lineTo(L / 2 - nose * 0.6, bodyH * 0.92);
      bodyShape.lineTo(L / 2 - nose, bodyH);
      bodyShape.lineTo(-L / 2 + nose, bodyH);
      bodyShape.lineTo(-L / 2 + nose * 0.6, bodyH * 0.92);
      bodyShape.lineTo(-L / 2, bodyH * 0.5);
      bodyShape.lineTo(-L / 2, 0);
      const geo = new THREE.ExtrudeGeometry(bodyShape, { depth: W, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.2, bevelSegments: 2 });
      geo.translate(0, 0, -W / 2);
      const body = shade(new THREE.Mesh(geo, mat(c1, { roughness: 0.4 })));
      body.position.y = floor;
      g.add(body);
      liveryPanels(g, st, L - 2 * nose, bodyH * 0.9, floor, W / 2 + 0.9);
      // windscreens
      for (const sx of [-1, 1]) {
        const ws = new THREE.Mesh(new THREE.PlaneGeometry(W - 6, 10), new THREE.MeshStandardMaterial({ color: '#1f2d3a', roughness: 0.1, metalness: 0.6 }));
        ws.position.set(sx * (L / 2 - nose * 0.3 + 0.5), floor + bodyH * 0.72, 0);
        ws.lookAt(ws.position.x + sx * 10, ws.position.y + 6, 0);
        g.add(ws);
        g.add(box(2, 3, W - 4, c2, sx * (L / 2 + 0.8), floor + 3));
      }
      g.add(box(L - 2 * nose - 10, 4, W - 10, '#4d4d4d', 0, floor + bodyH));
      pantograph(g, L * 0.26, floor + bodyH + 4);
      pantograph(g, -L * 0.26, floor + bodyH + 4);
      for (let i = 0; i < 3; i++) g.add(cyl(1.8, 1.8, 3, '#c8b89a', -12 + i * 12, floor + bodyH + 4, 0, 8));
      buffersAndCouplers(g, L, 11);
      lights(g, ud, L, 18, [-10, 10], floor + bodyH - 3);
      break;
    }
    case 'diesel-hood': {
      const floor = 12;
      bogie(g, ud, -L / 2 + 36, 2, 30, 5.8);
      bogie(g, ud, L / 2 - 36, 2, 30, 5.8);
      g.add(box(L, 5, W, '#2c2c2c', 0, floor - 4));
      g.add(box(L + 2, 1.5, W + 2, '#d9d4c7', 0, floor));
      const hoodTex = TX.liverySide(st, L, 30);
      const hoodMat = [mat(c1), mat(c1), mat(c1, { roughness: 0.45 }), mat(c1), new THREE.MeshStandardMaterial({ map: hoodTex, roughness: 0.45 }), new THREE.MeshStandardMaterial({ map: hoodTex, roughness: 0.45 })];
      const hoodL = L * 0.37;
      for (const sx of [-1, 1]) {
        const hg = new THREE.BoxGeometry(hoodL, 25, W - 8);
        faceURange(hg, 4, sx > 0 ? 0.63 : 0, sx > 0 ? 1 : 0.37);
        faceURange(hg, 5, sx > 0 ? 0 : 0.63, sx > 0 ? 0.37 : 1);
        const hood = shade(new THREE.Mesh(hg, hoodMat));
        hood.position.set(sx * (L / 2 - hoodL / 2), floor + 1.5 + 12.5, 0);
        g.add(hood);
        g.add(box(8, 3, 6, '#333', sx * (L / 2 - hoodL / 2), floor + 27, 0));
        g.add(box(hoodL, 1.5, 1, '#e8e8e8', sx * (L / 2 - hoodL / 2), floor + 18, W / 2 - 3.5));
        g.add(box(hoodL, 1.5, 1, '#e8e8e8', sx * (L / 2 - hoodL / 2), floor + 18, -W / 2 + 3.5));
      }
      const cabW = L - 2 * hoodL;
      const cab = shade(new THREE.Mesh(new THREE.BoxGeometry(cabW, 32, W), [
        new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }), new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }),
        mat(c1), mat(c1),
        new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }), new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }),
      ]));
      cab.position.set(0, floor + 1.5 + 16, 0);
      g.add(cab);
      g.add(roofProfile(cabW + 2, W + 1, 3, c1, floor + 33.5));
      g.add(box(L * 0.3, 7, W - 2, '#2a2a2a', 0, floor - 11));
      buffersAndCouplers(g, L, 11);
      lights(g, ud, L, 16, [-10, 10], floor + 22);
      break;
    }
    case 'diesel-shunter': {
      const floor = 11;
      const r = 5.8;
      const drv = [-L * 0.3, 0, L * 0.3];
      for (const x of drv) wheelset(g, ud, x, r, TX.discWheel());
      // coupling rods
      for (const s of [-1, 1]) {
        const rod = box(L * 0.6 + 4, 1.6, 1, '#777', 0, 0, s * (RAIL_GAUGE_HALF + 3));
        rod.geometry.translate(0, -0.8, 0);
        g.add(rod);
        ud.rods.push({ mesh: rod, cx: 0, cy: r, crank: 2.2, phase: s > 0 ? 0 : Math.PI / 2, wheelR: r });
      }
      g.add(box(L, 5, W - 4, '#2b2b2b', 0, floor - 5));
      g.add(box(L + 2, 1.5, W, '#222', 0, floor));
      const hoodL = L * 0.58;
      const hoodMat = [mat(c1), mat(c1), mat(c1), mat(c1), new THREE.MeshStandardMaterial({ map: TX.grille(c1) }), new THREE.MeshStandardMaterial({ map: TX.grille(c1) })];
      const hood = shade(new THREE.Mesh(new THREE.BoxGeometry(hoodL, 24, W - 10), hoodMat));
      hood.position.set(L / 2 - hoodL / 2, floor + 13.5, 0);
      g.add(hood);
      const cabL = L * 0.3;
      const cab = shade(new THREE.Mesh(new THREE.BoxGeometry(cabL, 34, W - 2), [
        new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }), new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }),
        mat(c1), mat(c1),
        new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }), new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) }),
      ]));
      cab.position.set(L / 2 - hoodL - cabL / 2, floor + 18.5, 0);
      g.add(cab);
      g.add(roofProfile(cabL + 3, W, 3, '#333', floor + 35.5));
      g.add(box(L - hoodL - cabL, 16, W - 12, c1, -L / 2 + (L - hoodL - cabL) / 2, floor + 1.5));
      g.add(cyl(1.6, 1.6, 7, '#222', L / 2 - hoodL * 0.6, floor + 25, 0, 8));
      for (const s of [-1, 1]) g.add(box(L, 1, 3, '#222', 0, floor + 1, s * (W / 2 - 1)));
      g.add(decal(TX.numberPlate('V 60 1199'), 16, 4, L / 2 - hoodL - cabL / 2, floor + 8, W / 2));
      buffersAndCouplers(g, L, 10);
      lights(g, ud, L, 14, [-9, 9], null);
      break;
    }
    case 'steam-tender':
    case 'steam-tank': {
      const tank = st.style === 'steam-tank';
      const big = st.ref === '4170';
      const engL = tank ? L : L * 0.6;
      const x0 = L / 2 - engL; // rear of the engine
      const rD = big ? 11.5 : st.ref === '4175' ? 8 : 8.6;
      const nD = big ? 3 : st.ref === '4175' ? 5 : 3;
      const spacing = rD * 2 + 1.5;
      const blackMat = mat(c1, { roughness: 0.55, metalness: 0.2 });
      const redMat = mat(c2, { roughness: 0.6 });
      const firstD = L / 2 - (big ? 58 : tank ? 42 : 34);
      const driverXs = [];
      for (let i = 0; i < nD; i++) driverXs.push(firstD - i * spacing);
      for (const x of driverXs) wheelset(g, ud, x, rD, TX.wheelFace(c2, big ? 18 : 14), '#555', RAIL_GAUGE_HALF + 1.6);
      // leading bogie / pony axle and trailing axle
      const leadR = 5.2;
      wheelset(g, ud, L / 2 - 14, leadR, TX.wheelFace(c2, 10));
      if (big) wheelset(g, ud, L / 2 - 30, leadR, TX.wheelFace(c2, 10));
      if (tank || big) wheelset(g, ud, x0 + 14, 6, TX.wheelFace(c2, 12));
      // frame (red)
      for (const s of [-1, 1]) g.add(box(engL - 6, rD + 4, 1.4, redMat, L / 2 - engL / 2, 4, s * (RAIL_GAUGE_HALF - 1)));
      // running boards
      for (const s of [-1, 1]) g.add(box(engL - 16, 1.2, 5, blackMat, L / 2 - engL / 2 - 4, rD * 2 + 5, s * (W / 2 - 2.5)));
      // cylinders and valve chests
      for (const s of [-1, 1]) {
        g.add(hcyl(4.2, 16, blackMat, L / 2 - 22, 10, s * 12.5, 14));
        g.add(box(14, 6, 5, blackMat, L / 2 - 22, 14, s * 12));
      }
      // boiler
      const boilerR = big ? 13 : 11.5;
      const boilerY = rD * 2 + 5 + boilerR - 2;
      const bl = engL - 30;
      const boilerX = L / 2 - 6 - bl / 2;
      g.add(hcyl(boilerR, bl, blackMat, boilerX, boilerY, 0, 28));
      for (let i = 0; i < 5; i++) g.add(hcyl(boilerR + 0.4, 1.2, '#8a8a8a', boilerX - bl / 2 + 8 + i * (bl - 16) / 4, boilerY, 0, 28));
      g.add(hcyl(boilerR + 1, 3, '#222', L / 2 - 5, boilerY, 0, 28)); // smokebox door ring
      const door = new THREE.Mesh(new THREE.CircleGeometry(boilerR - 1, 24), mat('#161616', { metalness: 0.3 }));
      door.rotation.y = Math.PI / 2;
      door.position.set(L / 2 - 3.4, boilerY, 0);
      g.add(door);
      const chimneyObj = cyl(3.4, 4.2, big ? 9 : 10, '#111', L / 2 - 14, boilerY + boilerR - 2, 0, 14);
      g.add(chimneyObj);
      ud.chimney = chimneyObj;
      g.add(cyl(4.6, 5.2, 5, blackMat, boilerX + 6, boilerY + boilerR - 1, 0, 14)); // dome
      g.add(cyl(3.2, 3.8, 4, blackMat, boilerX - 18, boilerY + boilerR - 1, 0, 12)); // sand dome
      // smoke deflectors (Wagner type)
      if (!tank) for (const s of [-1, 1]) g.add(box(26, 22, 0.8, blackMat, L / 2 - 20, boilerY - 8, s * (boilerR + 3)));
      // headlight lamps
      lights(g, ud, L, rD * 2 + 9, [-9, 9], boilerY + boilerR + 2);
      // cab
      const cabL = 22;
      const cabX = x0 + (tank ? 18 : 12);
      const cabMat = new THREE.MeshStandardMaterial({ map: TX.cabSide(c1) });
      const cab = shade(new THREE.Mesh(new THREE.BoxGeometry(cabL, 34, W - 1), [cabMat, cabMat, blackMat, blackMat, cabMat, cabMat]));
      cab.position.set(cabX, rD * 2 + 5 + 17, 0);
      g.add(cab);
      g.add(roofProfile(cabL + 4, W + 2, 4, '#222', rD * 2 + 5 + 34));
      if (tank) {
        for (const s of [-1, 1]) g.add(box(engL * 0.4, 16, 6, blackMat, L / 2 - engL * 0.45, rD * 2 + 5, s * (boilerR + 3)));
        g.add(box(16, 26, W - 2, blackMat, x0 + 5, rD * 2 + 3));
        g.add(box(14, 4, W - 6, new THREE.MeshStandardMaterial({ map: TX.coal() }), x0 + 5, rD * 2 + 29));
      } else {
        // tender
        const tl = L - engL - 3;
        const tx = -L / 2 + tl / 2;
        g.add(box(tl, 5, W - 8, redMat, tx, 7));
        bogie(g, ud, -L / 2 + tl * 0.26, 2, 17, 5.2);
        bogie(g, ud, -L / 2 + tl * 0.74, 2, 17, 5.2);
        const tenderH = st.ref === '4175' ? 30 : 27;
        g.add(box(tl, tenderH, W, blackMat, tx, 14));
        g.add(box(tl * 0.75, 4, W - 6, new THREE.MeshStandardMaterial({ map: TX.coal() }), tx + tl * 0.08, 14 + tenderH));
        if (st.ref === '4175') { // cabin tender
          g.add(box(9, 16, W - 4, cabMat, -L / 2 + 5, 14 + tenderH));
        }
        g.add(decal(TX.numberPlate(st.ref === '4170' ? '01 220' : '50 058'), 16, 4, cabX, rD * 2 + 16, W / 2));
      }
      // coupling rods and main rods
      for (const s of [-1, 1]) {
        const first = driverXs[0], last = driverXs[driverXs.length - 1];
        const len = first - last;
        const rod = box(len + 4, 1.8, 1, '#8a8a8a', 0, 0, s * (RAIL_GAUGE_HALF + 4), null);
        rod.geometry.translate(0, -0.9, 0);
        g.add(rod);
        ud.rods.push({ mesh: rod, cx: (first + last) / 2, cy: rD, crank: rD * 0.45, phase: s > 0 ? 0 : Math.PI / 2, wheelR: rD });
        const main = box(1, 1.6, 1, '#9a9a9a', 0, 0, s * (RAIL_GAUGE_HALF + 5.2));
        g.add(main);
        ud.rods.push({ mesh: main, main: true, from: L / 2 - 30, to: first, cy: rD, crank: rD * 0.45, phase: s > 0 ? 0 : Math.PI / 2, wheelR: rD, y0: 10 });
      }
      buffersAndCouplers(g, L, 11);
      break;
    }
    case 'open': {
      wheelset(g, ud, -L * 0.3, 5, TX.discWheel());
      wheelset(g, ud, L * 0.3, 5, TX.discWheel());
      g.add(box(L, 4, W - 4, '#262626', 0, 7));
      for (const s of [-1, 1]) g.add(box(L - 20, 5, 1.4, '#262626', 0, 4, s * (RAIL_GAUGE_HALF + 3)));
      const wood = new THREE.MeshStandardMaterial({ map: TX.planks(c1, 3), roughness: 0.95 });
      const sideH = 21;
      for (const s of [-1, 1]) {
        const side = box(L, sideH, 1.6, wood, 0, 11, s * (W / 2 - 0.8), [40, 20]);
        side.geometry.attributes.uv.needsUpdate = true;
        g.add(side);
        g.add(box(2, sideH, 2.4, wood, s * (L / 2 - 1), 11, 0));
      }
      g.add(box(2, sideH, W, wood, L / 2 - 1, 11, 0, [40, 20]));
      g.add(box(2, sideH, W, wood, -L / 2 + 1, 11, 0, [40, 20]));
      for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) g.add(box(1.5, sideH + 1, 1, '#222', -L / 2 + 4 + i * (L - 8) / 6, 11, s * (W / 2 + 0.4)));
      // coal load
      const load = box(L - 4, 3, W - 4, new THREE.MeshStandardMaterial({ map: TX.coal(), roughness: 1 }), 0, 11 + sideH - 5);
      g.add(load);
      buffersAndCouplers(g, L, 10);
      g.add(decal(TX.numberPlate('Omm 52', '#6b3a24', '#f0e6c8'), 18, 4.5, L * 0.3, 16, W / 2 + 0.9));
      break;
    }
    case 'flat': {
      bogie(g, ud, -L / 2 + 28, 2, 18, 5);
      bogie(g, ud, L / 2 - 28, 2, 18, 5);
      g.add(box(L, 4, W, new THREE.MeshStandardMaterial({ map: TX.planks(c1, 5) }), 0, 11, 0, [30, 30]));
      for (const s of [-1, 1]) g.add(box(L, 4, 1.5, '#222', 0, 8, s * (W / 2 - 1)));
      for (const bx of [-L * 0.25, L * 0.25]) {
        g.add(box(8, 6, W, '#3b2c20', bx, 15));
        for (const s of [-1, 1]) g.add(box(2, 22, 2, '#3b2c20', bx, 15, s * (W / 2 - 1)));
      }
      const barkMat = new THREE.MeshStandardMaterial({ map: TX.bark() });
      const R = TX.rng(3);
      for (let i = 0; i < 7; i++) {
        const row = i < 4 ? 0 : 1;
        const col = row ? i - 4 : i;
        const r = 3.6 + R() * 0.8;
        const log = hcyl(r, L * 0.86, barkMat, 0, 21 + r + row * 7, -11 + col * (row ? 7.5 : 7.3) + (row ? 3.6 : 0), 10);
        g.add(log);
      }
      buffersAndCouplers(g, L, 10);
      break;
    }
    default:
      g.add(box(L, 30, W, c1, 0, 10));
  }
  return g;
}

// Per-frame animation of wheels, rods and lights. `travel` is the distance
// moved since last frame along the vehicle's +x (negative when backwards).
export function animateStock(obj, travel, leading, running) {
  const ud = obj.userData;
  if (!ud || !ud.wheels) return;
  ud.angle = (ud.angle || 0) - travel;
  for (const w of ud.wheels) w.obj.rotation.z = ud.angle / w.r;
  for (const r of ud.rods) {
    const th = ud.angle / r.wheelR + r.phase;
    const px = Math.cos(th) * r.crank, py = Math.sin(th) * r.crank;
    if (r.main) {
      // from crosshead (slides at cylinder height) to the crank pin
      const cx = r.to + px, cy = r.cy + py;
      const hx = r.from + px * 0.2, hy = r.y0 + 4;
      const len = Math.hypot(cx - hx, cy - hy);
      r.mesh.scale.x = len;
      r.mesh.position.set((cx + hx) / 2, (cy + hy) / 2 - 0.8, r.mesh.position.z);
      r.mesh.rotation.z = Math.atan2(cy - hy, cx - hx);
    } else {
      r.mesh.position.x = r.cx + px;
      r.mesh.position.y = r.cy + py;
    }
  }
  if (ud.lightFront && ud.kind === 'loco') {
    const on = running;
    ud.lightFront.emissive.set(on && leading > 0 ? '#fff4d0' : '#000000');
    ud.lightRear.emissive.set(on && leading < 0 ? '#fff4d0' : '#000000');
  }
}
