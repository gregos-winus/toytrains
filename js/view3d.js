// 3D view (three.js): terrain, tracks, tunnels, bridges, scenery and trains.
// Plan coordinates (x, y, height z) map to three.js (x, z, -y).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { pieceGeometry, isSwitchable, GAUGE } from './catalog/tracks.js';
import { sceneryType } from './catalog/scenery.js';
import { stock } from './catalog/rolling-stock.js';
import {
  worldEndpoints, PAINTS, WATER_LEVEL, trackSamples, tunnelPortals, VAULT_HEIGHT, VAULT_HALF_WIDTH,
  terrainHeight, TUNNEL_CLEARANCE,
} from './model.js';
import { carPoses, nearestTrackPoint } from './sim.js';
import { toggleSwitch } from './editor.js';
import { carveTerrain, terrainIndices, CLASS_NONE } from './carve.js';
import { buildScenery, buildStock, buildPortal, animateStock, mat } from './models3d.js';
import * as TX from './textures.js';

const BALLAST_Z = 3;       // top of ballast above track base height
const RAIL_BASE = 3.8;     // bottom of rail
const RAIL_H = 2.2;        // code 100 ≈ 2.5 mm
const BOARD_BOTTOM = -180;
const BRIDGE_GAP = 20;     // track this far above the ground stands on a bridge

export class View3D {
  constructor(app, container) {
    this.app = app;
    this.container = container;
    this.visible = true;
    this.camMode = 'orbit';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = this.skyTexture();
    scene.fog = new THREE.Fog('#c9dbe8', 7000, 22000);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(42, 1, 5, 60000);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight('#e4f0ff', '#6b5a44', 1.1));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.6;
    scene.add(sun, sun.target);
    this.sun = sun;

    // the room: parquet floor
    const parquet = TX.parquet();
    parquet.repeat.set(60, 60);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ map: parquet, roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -760;
    floor.receiveShadow = true;
    scene.add(floor);

    this.boardGroup = new THREE.Group();
    this.trackGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.trainGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    scene.add(this.boardGroup, this.trackGroup, this.sceneryGroup, this.trainGroup, this.fxGroup);
    this.trainObjs = new Map();
    this.odo = new Map();
    this.tunnelK = new Map();
    this.puffs = [];

    this.dirtyStatic = true;
    this.dirtyScenery = true;
    this.lastLive = 0;
    const live = () => { this.liveDirty = true; };
    app.on('layout', () => { this.dirtyStatic = true; this.dirtyScenery = true; });
    app.on('terrain', () => { this.dirtyStatic = true; this.dirtyScenery = true; });
    app.on('layout-live', live);
    app.on('terrain-live', live);

    this.raycaster = new THREE.Raycaster();
    renderer.domElement.addEventListener('pointerdown', (e) => { this.downAt = { x: e.clientX, y: e.clientY }; });
    renderer.domElement.addEventListener('pointerup', (e) => this.onClick(e));

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.resetCamera();
  }

  skyTexture() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#7fa8d1');
    g.addColorStop(0.45, '#bcd4ea');
    g.addColorStop(0.55, '#dfe6ea');
    g.addColorStop(1, '#bfb8aa');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    this.w = Math.max(10, r.width);
    this.h = Math.max(10, r.height);
    this.renderer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  resetCamera() {
    const b = this.app.layout.board;
    const cx = b.w / 2, cz = -b.d / 2;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dist = Math.max((b.w * 0.55) / Math.tan(hfov / 2), (b.d * 1.1) / Math.tan(vfov / 2)) * 0.95;
    const elev = 0.85; // radians above the horizon
    this.camera.position.set(cx, Math.sin(elev) * dist, cz + Math.cos(elev) * dist);
    this.controls.target.set(cx, 0, cz);
    this.controls.update();
    this.updateSun();
  }

  updateSun() {
    const b = this.app.layout.board;
    const cx = b.w / 2, cz = -b.d / 2;
    const span = Math.max(b.w, b.d);
    this.sun.position.set(cx - span * 0.45, span * 1.1, cz + span * 0.55);
    this.sun.target.position.set(cx, 0, cz);
    const cam = this.sun.shadow.camera;
    cam.left = -span * 0.75; cam.right = span * 0.75; cam.top = span * 0.75; cam.bottom = -span * 0.75;
    cam.near = 10; cam.far = span * 4;
    cam.updateProjectionMatrix();
  }

  setCamMode(mode) {
    this.camMode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.controls.target.copy(this.camera.position).addScaledVector(dir, 600);
      this.controls.update();
    }
    this.app.emit('cammode', mode);
  }

  clear(group) {
    for (const c of [...group.children]) {
      group.remove(c);
      c.traverse?.((o) => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); });
    }
  }

  // ================================================================ static
  rebuildStatic() {
    const L = this.app.layout;
    this.samples = trackSamples(L, 8);
    this.carve = carveTerrain(L, this.samples);
    this.buildTerrain();
    this.buildTracks();
  }

  // Height of the rendered (carved) terrain.
  groundAt(x, y) {
    const c = this.carve;
    if (!c) return 0;
    const fx = Math.min(Math.max(x / c.cell, 0), c.nx - 1.001), fy = Math.min(Math.max(y / c.cell, 0), c.ny - 1.001);
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const H = c.heights, n = c.nx;
    const a = H[j * n + i] * (1 - tx) + H[j * n + i + 1] * tx;
    const b = H[(j + 1) * n + i] * (1 - tx) + H[(j + 1) * n + i + 1] * tx;
    return a * (1 - ty) + b * ty;
  }

  buildTerrain() {
    const g = this.boardGroup;
    this.clear(g);
    const L = this.app.layout;
    const T = L.terrain;
    const c = this.carve;
    const { nx, ny, xs, ys, heights } = c;
    const N = nx * ny;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), uv = new Float32Array(N * 2);
    const rock = PAINTS[3].color;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = xs[i], y = ys[j], h = heights[k];
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -y;
        uv[k * 2] = x / 160; uv[k * 2 + 1] = y / 160;
        // paint from the stored grid (nearest cell)
        const ti = Math.min(T.nx - 1, Math.round(x / T.cell)), tj = Math.min(T.ny - 1, Math.round(y / T.cell));
        let pc = PAINTS[T.paint[tj * T.nx + ti]]?.color || PAINTS[0].color;
        // steep slopes show rock
        const hx = heights[j * nx + Math.min(nx - 1, i + 1)] - heights[j * nx + Math.max(0, i - 1)];
        const hy = heights[Math.min(ny - 1, j + 1) * nx + i] - heights[Math.max(0, j - 1) * nx + i];
        const slope = Math.hypot(hx, hy) / (2 * c.cell);
        const r = Math.min(1, Math.max(0, (slope - 0.7) * 1.4));
        const mix = (a, b) => a + (b - a) * r;
        pc = [mix(pc[0], rock[0]), mix(pc[1], rock[1]), mix(pc[2], rock[2])];
        const lift = 1.08 * (1 + Math.max(-0.15, Math.min(0.08, h / 900)));
        col[k * 3] = Math.pow(Math.min(1, (pc[0] / 255) * lift), 2.2);
        col[k * 3 + 1] = Math.pow(Math.min(1, (pc[1] / 255) * lift), 2.2);
        col[k * 3 + 2] = Math.pow(Math.min(1, (pc[2] / 255) * lift), 2.2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(terrainIndices(c));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, map: TX.groundDetail(), normalMap: TX.groundNormal(), normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.97, side: THREE.DoubleSide,
    }));
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    g.add(terrain);
    this.terrainMesh = terrain;

    // board sides (plywood) and frame
    const side = [], sideUV = [];
    const P = (i, j) => ({ x: xs[i], h: heights[j * nx + i], z: -ys[j] });
    const edge = (pts) => {
      let u = 0;
      for (let n = 0; n < pts.length - 1; n++) {
        const [a, b] = [pts[n], pts[n + 1]];
        const du = Math.hypot(b.x - a.x, b.z - a.z) / 200;
        side.push(a.x, a.h, a.z, a.x, BOARD_BOTTOM, a.z, b.x, b.h, b.z);
        side.push(b.x, b.h, b.z, a.x, BOARD_BOTTOM, a.z, b.x, BOARD_BOTTOM, b.z);
        sideUV.push(u, a.h / 200, u, BOARD_BOTTOM / 200, u + du, b.h / 200, u + du, b.h / 200, u, BOARD_BOTTOM / 200, u + du, BOARD_BOTTOM / 200);
        u += du;
      }
    };
    const south = [], north = [], west = [], east = [];
    for (let i = 0; i < nx; i++) { south.push(P(i, 0)); north.push(P(nx - 1 - i, ny - 1)); }
    for (let j = 0; j < ny; j++) { east.push(P(nx - 1, j)); west.push(P(0, ny - 1 - j)); }
    edge(south); edge(east); edge(north); edge(west);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(side), 3));
    sg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sideUV), 2));
    sg.computeVertexNormals();
    const plywood = TX.planks('#8a6a48', 19);
    const sides = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: plywood, roughness: 0.75, side: THREE.DoubleSide }));
    sides.castShadow = true;
    sides.receiveShadow = true;
    g.add(sides);
    const legMat = mat('#5d4430', { roughness: 0.6 });
    const lx = [60, L.board.w - 60], lz = [-60, -L.board.d + 60];
    if (L.board.w > 2600) lx.splice(1, 0, L.board.w / 2);
    for (const x of lx) for (const z of lz) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(50, 580, 50), legMat);
      leg.position.set(x, BOARD_BOTTOM - 290, z);
      leg.castShadow = true;
      g.add(leg);
    }
    // water
    let minH = Infinity;
    for (const h of heights) minH = Math.min(minH, h);
    this.water = null;
    if (minH < WATER_LEVEL) {
      const wn = TX.waterNormal();
      wn.repeat.set(L.board.w / 300, L.board.d / 300);
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(L.board.w, L.board.d),
        new THREE.MeshStandardMaterial({
          color: '#2d5f7e', transparent: true, opacity: 0.82, roughness: 0.06, metalness: 0.15,
          normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35),
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(L.board.w / 2, WATER_LEVEL, -L.board.d / 2);
      water.receiveShadow = true;
      g.add(water);
      this.water = water;
    }
    this.buildTufts();
    this.updateSun();
  }

  // Grass tufts scattered on grass and meadow areas.
  buildTufts() {
    const L = this.app.layout;
    const c = this.carve;
    const T = L.terrain;
    const R = TX.rng(1234);
    const count = Math.min(9000, Math.round((L.board.w * L.board.d) / 380));
    const blockers = L.scenery.filter((s) => !['tree', 'conifer', 'bush', 'rock', 'people', 'lamp', 'signal', 'fence'].includes(s.kind)).map((s) => {
      const st = sceneryType(s.kind);
      return st ? { x: s.x, y: s.y, r: Math.hypot(st.w, st.d) * 0.5 * (s.scale || 1) } : null;
    }).filter(Boolean);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const list = [];
    for (let n = 0; n < count * 3 && list.length < count; n++) {
      const x = R() * L.board.w, y = R() * L.board.d;
      const ti = Math.min(T.nx - 1, Math.round(x / T.cell)), tj = Math.min(T.ny - 1, Math.round(y / T.cell));
      const paint = T.paint[tj * T.nx + ti];
      if (paint > 1) continue;
      const ci = Math.round(x / c.cell), cj = Math.round(y / c.cell);
      const k = cj * c.nx + ci;
      if (c.nearD[k] < 34 || c.cls[k] !== CLASS_NONE) continue;
      const h = this.groundAt(x, y);
      if (h < WATER_LEVEL + 1) continue;
      if (blockers.some((b) => Math.hypot(b.x - x, b.y - y) < b.r)) continue;
      list.push({ x, y, h, rot: R() * Math.PI, sc: 0.6 + R() * 0.8 });
    }
    if (!list.length) return;
    const geo = new THREE.BufferGeometry();
    // two crossed quads, 10 mm wide, 8 mm high
    const p = [], uv = [], idx = [];
    for (let k = 0; k < 2; k++) {
      const a = k * Math.PI / 2, dx = Math.cos(a) * 3.5, dz = Math.sin(a) * 3.5, b = k * 4;
      p.push(-dx, 0, -dz, dx, 0, dz, dx, 5, dz, -dx, 5, -dz);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const matT = new THREE.MeshStandardMaterial({ map: TX.tuftTexture(), color: '#b8c8a0', alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
    const im = new THREE.InstancedMesh(geo, matT, list.length);
    const up = new THREE.Vector3(0, 1, 0);
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      v.set(t.x, t.h - 0.3, -t.y);
      s.set(t.sc, t.sc, t.sc);
      m4.compose(v, q, s);
      im.setMatrixAt(i, m4);
    });
    im.receiveShadow = true;
    this.boardGroup.add(im);
  }

  // ================================================================ tracks
  buildTracks() {
    const g = this.trackGroup;
    this.clear(g);
    const L = this.app.layout;
    const ballast = [], ballastUV = [], railTop = [], railSide = [], vault = [], vaultUV = [], girders = [];
    const sleepers = [], piers = [];
    const extras = [];
    const V = (p, off, dz) => [p.x - Math.sin(p.a) * off, p.z + dz, -(p.y + Math.cos(p.a) * off)];
    const quad = (arr, a, b, c, d) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
    const quadUV = (arr, u0, u1, v0, v1) => arr.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);

    // spatial index of samples to avoid piers standing on lower tracks
    const grid = new Map();
    for (const r of this.samples) for (const p of r.pts) {
      const k = `${Math.floor(p.x / 50)},${Math.floor(p.y / 50)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(p);
    }
    const trackBelow = (p) => {
      const cx = Math.floor(p.x / 50), cy = Math.floor(p.y / 50);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const q of grid.get(`${cx + dx},${cy + dy}`) || []) {
          if (q.z < p.z - 30 && Math.hypot(q.x - p.x, q.y - p.y) < 34) return true;
        }
      }
      return false;
    };

    this.portalWalls = this.groupPortals();
    const behindWall = (p) => this.portalWalls.some((w) => {
      const dx = p.x - w.x, dy = p.y - w.y;
      const along = dx * Math.cos(w.a) + dy * Math.sin(w.a);
      const lat = -dx * Math.sin(w.a) + dy * Math.cos(w.a);
      return along < 2 && along > -140 && Math.abs(lat) < w.width / 2 && Math.abs(p.z - w.z) < 20;
    });
    const byPiece = new Map();
    for (const r of this.samples) {
      if (!byPiece.has(r.pid)) byPiece.set(r.pid, []);
      byPiece.get(r.pid).push(r);
    }

    for (const piece of L.pieces) {
      const geo = pieceGeometry(piece);
      if (!geo) continue;
      const active = geo.states[piece.state || 0] || geo.states[0];
      const routes = byPiece.get(piece.id) || [];
      const multi = ['turnout', 'threeway', 'curvedturnout'].includes(geo.kind);
      for (const r of routes) {
        const pts = r.pts;
        let dist = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const seg = Math.hypot(b.x - a.x, b.y - a.y);
          const u0 = dist / 40, u1 = (dist + seg) / 40;
          dist += seg;
          // ballast bed: slope, top, slope
          quad(ballast, V(a, 19, 0), V(b, 19, 0), V(b, 14.5, BALLAST_Z), V(a, 14.5, BALLAST_Z)); quadUV(ballastUV, u0, u1, 0, 0.12);
          quad(ballast, V(a, 14.5, BALLAST_Z), V(b, 14.5, BALLAST_Z), V(b, -14.5, BALLAST_Z), V(a, -14.5, BALLAST_Z)); quadUV(ballastUV, u0, u1, 0.12, 0.85);
          quad(ballast, V(a, -14.5, BALLAST_Z), V(b, -14.5, BALLAST_Z), V(b, -19, 0), V(a, -19, 0)); quadUV(ballastUV, u0, u1, 0.85, 0.97);
          // rails: bright running surface, rusty sides
          for (const off of [GAUGE / 2, -GAUGE / 2]) {
            const t0 = RAIL_BASE + RAIL_H;
            quad(railTop, V(a, off + 0.55, t0), V(b, off + 0.55, t0), V(b, off - 0.55, t0), V(a, off - 0.55, t0));
            quad(railSide, V(a, off + 0.7, RAIL_BASE), V(b, off + 0.7, RAIL_BASE), V(b, off + 0.55, t0), V(a, off + 0.55, t0));
            quad(railSide, V(a, off - 0.55, t0), V(b, off - 0.55, t0), V(b, off - 0.7, RAIL_BASE), V(a, off - 0.7, RAIL_BASE));
          }
          // tunnel vault
          if ((a.tunnel || behindWall(a)) && (b.tunnel || behindWall(b))) {
            const prof = vaultProfile();
            for (let k = 0; k < prof.length - 1; k++) {
              const [o0, h0] = prof[k], [o1, h1] = prof[k + 1];
              quad(vault, V(a, o0, h0), V(b, o0, h0), V(b, o1, h1), V(a, o1, h1));
              vaultUV.push(...[u0, h0 / 40, u1, h0 / 40, u1, h1 / 40, u0, h0 / 40, u1, h1 / 40, u0, h1 / 40]);
            }
          }
          // plate girders on bridges
          const ga = a.z - a.ground > BRIDGE_GAP && !a.tunnel, gb = b.z - b.ground > BRIDGE_GAP && !b.tunnel;
          if (ga && gb) {
            for (const off of [20.5, -20.5]) {
              quad(girders, V(a, off, -16), V(b, off, -16), V(b, off, 6), V(a, off, 6));
            }
            quad(girders, V(a, 20.5, -16), V(b, 20.5, -16), V(b, -20.5, -16), V(a, -20.5, -16));
          }
        }
        // sleepers
        if (!multi || r.ri === 0) {
          const len = pts.length > 1 ? r.pts[r.pts.length - 1].s : 0;
          const n = Math.floor(len / 7.2);
          for (let i = 0; i < n; i++) {
            const k = ((i + 0.5) / n) * (pts.length - 1);
            const a = pts[Math.floor(k)], b = pts[Math.min(pts.length - 1, Math.floor(k) + 1)], f = k - Math.floor(k);
            sleepers.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, a: a.a, wide: multi });
          }
        }
        // piers
        const step = Math.max(1, Math.round(150 / 8));
        for (let i = 0; i < pts.length; i += step) {
          const p = pts[i];
          if (p.tunnel || p.z - p.ground <= BRIDGE_GAP) continue;
          if (trackBelow(p)) continue;
          piers.push({ x: p.x, y: p.y, a: p.a, top: p.z - 16, bottom: Math.min(p.ground, this.groundAt(p.x, p.y)) - 4 });
        }
        void active;
      }
      if (geo.electric) {
        const e = worldEndpoints(piece)[0];
        const inward = e.a + Math.PI;
        const side = geo.hand && geo.hand < 0 ? 1 : -1;
        extras.push({ kind: 'motor', x: e.x + Math.cos(inward) * 25 - Math.sin(inward) * 27 * side, y: e.y + Math.sin(inward) * 25 + Math.cos(inward) * 27 * side, z: e.z, a: inward });
      }
      if (geo.kind === 'buffer') {
        const e = worldEndpoints(piece).find((x) => x.buffer);
        extras.push({ kind: 'buffer', x: e.x, y: e.y, z: e.z, a: e.a });
      }
    }

    const mk = (arr, material, uvArr = null, cast = false) => {
      if (!arr.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
      if (uvArr) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvArr), 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material);
      m.receiveShadow = true;
      m.castShadow = cast;
      g.add(m);
      return m;
    };
    this.ballastMesh = mk(ballast, new THREE.MeshStandardMaterial({ map: TX.gravel(), roughness: 1, side: THREE.DoubleSide, bumpMap: TX.gravel(), bumpScale: 0.6 }), ballastUV, true);
    mk(railTop, new THREE.MeshStandardMaterial({ color: '#d7d9dc', metalness: 0.9, roughness: 0.22, side: THREE.DoubleSide }));
    mk(railSide, new THREE.MeshStandardMaterial({ color: '#6b4a34', metalness: 0.3, roughness: 0.75, side: THREE.DoubleSide }));
    mk(vault, new THREE.MeshStandardMaterial({ map: TX.stone('#5a5650'), color: '#2b2926', roughness: 1, envMapIntensity: 0, side: THREE.DoubleSide }), vaultUV, true);
    mk(girders, new THREE.MeshStandardMaterial({ color: '#3f4a52', metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide }), null, true);

    if (sleepers.length) {
      const sg = new THREE.BoxGeometry(2.6, 1.0, 27);
      const im = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ map: TX.sleeperWood(), roughness: 0.9 }), sleepers.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      sleepers.forEach((p, i) => {
        q.setFromAxisAngle(up, p.a);
        v.set(p.x, p.z + BALLAST_Z + 0.4, -p.y);
        m4.compose(v, q, new THREE.Vector3(1, 1, p.wide ? 1.9 : 1));
        im.setMatrixAt(i, m4);
      });
      im.receiveShadow = true;
      g.add(im);
    }
    if (piers.length) {
      const pg = new THREE.BoxGeometry(18, 1, 42);
      const im = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ map: TX.stone('#a39c90'), roughness: 0.95 }), piers.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      piers.forEach((p, i) => {
        const h = Math.max(1, p.top - p.bottom);
        q.setFromAxisAngle(up, p.a);
        v.set(p.x, p.bottom + h / 2, -p.y);
        s.set(1, h, 1);
        m4.compose(v, q, s);
        im.setMatrixAt(i, m4);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      g.add(im);
    }
    for (const w of this.portalWalls) {
      const portal = buildPortal(w.height, 0, w.width, w.offs);
      portal.position.set(w.x, w.z - 1, -w.y);
      portal.rotation.y = w.a;
      g.add(portal);
    }
    for (const x of extras) {
      let m;
      if (x.kind === 'motor') {
        m = new THREE.Group();
        m.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(34, 9, 15), mat('#2f2f2f', { roughness: 0.5 })), { castShadow: true }));
        const cover = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 12), mat('#4a4a4a'));
        cover.position.y = 5;
        m.add(cover);
        m.position.set(x.x, x.z + 4.5, -x.y);
      } else {
        m = new THREE.Group();
        const beam = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 30), mat('#c0392b'));
        beam.position.set(-4, 14, 0);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 26), mat('#f2f2f2'));
        plate.position.set(-1.8, 14, 0);
        m.add(beam, plate);
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(20, 2.5, 2.5), mat('#3a3a3a'));
          post.position.set(-11, 9, s * 8.25);
          post.rotation.z = -0.55;
          m.add(post);
        }
        m.position.set(x.x, x.z, -x.y);
      }
      m.rotation.y = x.a;
      m.traverse((o) => { o.castShadow = true; });
      g.add(m);
    }
  }

  // Tunnel mouths; neighbouring parallel mouths share one head wall.
  groupPortals() {
    const portals = tunnelPortals(this.samples);
    const used = new Set();
    const walls = [];
    for (let i = 0; i < portals.length; i++) {
      if (used.has(i)) continue;
      const group = [portals[i]];
      used.add(i);
      for (let j = i + 1; j < portals.length; j++) {
        const q = portals[j];
        if (used.has(j)) continue;
        const da = Math.abs(Math.atan2(Math.sin(q.a - portals[i].a), Math.cos(q.a - portals[i].a)));
        if (da < 0.35 && Math.hypot(q.x - portals[i].x, q.y - portals[i].y) < 120 && Math.abs(q.z - portals[i].z) < 10) {
          group.push(q);
          used.add(j);
        }
      }
      const a = portals[i].a;
      // the wall stands at the outermost mouth
      let cx = group.reduce((s, p) => s + p.x, 0) / group.length;
      let cy = group.reduce((s, p) => s + p.y, 0) / group.length;
      const along = group.map((p) => (p.x - cx) * Math.cos(a) + (p.y - cy) * Math.sin(a));
      const shift = Math.max(...along);
      cx += Math.cos(a) * shift;
      cy += Math.sin(a) * shift;
      const z = Math.min(...group.map((p) => p.z));
      const top = Math.max(...group.map((p) => p.top));
      const offs = group.map((p) => -(p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a));
      const span = Math.max(...offs) - Math.min(...offs);
      walls.push({ x: cx, y: cy, z, a, offs, width: 160 + span, height: Math.max(105, Math.min(320, top - z + 20)) });
    }
    return walls;
  }

  // ================================================================ scenery
  buildScenery() {
    const g = this.sceneryGroup;
    this.clear(g);
    const L = this.app.layout;
    for (const s of L.scenery) {
      const st = sceneryType(s.kind);
      if (!st) continue;
      const obj = buildScenery(st);
      let z = Infinity;
      const k = s.scale || 1;
      const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
      for (const [dx, dy] of [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        const lx = dx * st.w * k, ly = dy * st.d * k;
        z = Math.min(z, this.groundAt(s.x + lx * c - ly * sn, s.y + lx * sn + ly * c));
      }
      if (s.z != null) z = s.z;
      obj.position.set(s.x, z, -s.y);
      obj.rotation.y = s.rot || 0;
      obj.scale.setScalar(k);
      g.add(obj);
    }
  }

  // ================================================================ trains
  updateTrains(dt) {
    const L = this.app.layout;
    const seen = new Set();
    for (const train of L.trains) {
      const cars = carPoses(L, train);
      // head lamps and interior lights come on while the train is in a tunnel
      const inTunnel = cars.some((c) => terrainHeight(L.terrain, c.x, c.y) > c.z + TUNNEL_CLEARANCE);
      const k0 = this.tunnelK.get(train.id) || 0;
      const k = k0 + ((inTunnel ? 1 : 0) - k0) * Math.min(1, dt * 5);
      this.tunnelK.set(train.id, k);
      const odo = train.odo || 0;
      const last = this.odo.get(train.id) ?? odo;
      const moved = odo - last;
      this.odo.set(train.id, odo);
      cars.forEach((car, i) => {
        const key = `${train.id}:${i}:${car.ref}`;
        seen.add(key);
        let obj = this.trainObjs.get(key);
        if (!obj) {
          obj = buildStock(stock(car.ref) || { style: 'box', length: car.length, color: '#999' });
          this.trainObjs.set(key, obj);
          this.trainGroup.add(obj);
        }
        obj.position.set(car.x, car.z + RAIL_BASE + RAIL_H, -car.y);
        obj.rotation.order = 'YZX';
        obj.rotation.y = car.a + (car.flip ? Math.PI : 0);
        obj.rotation.z = car.flip ? -car.pitch : car.pitch;
        const dirSign = car.flip ? -1 : 1;
        const role = i === 0 ? 'head' : i === cars.length - 1 ? 'tail' : 'mid';
        animateStock(obj, moved * dirSign, dirSign, true, k, role);
        const ud0 = obj.userData;
        if (ud0.kind === 'loco' && ud0.bodyLen) {
          if (!ud0.spot) {
            const spot = new THREE.SpotLight('#fff1d2', 0, 1400, 0.55, 0.5, 0);
            spot.castShadow = false;
            obj.add(spot, spot.target);
            ud0.spot = spot;
          }
          const lead = dirSign > 0 ? 1 : -1;
          ud0.spot.position.set(lead * (ud0.bodyLen / 2 + 3), ud0.lampY, 0);
          ud0.spot.target.position.set(lead * (ud0.bodyLen / 2 + 500), -10, 0);
          ud0.spot.intensity = role === 'head' ? 40 * k : 0;
        }
        // steam
        const ud = obj.userData;
        if (ud.chimney && train.speed > 1) {
          ud.smokeClock = (ud.smokeClock || 0) + dt;
          const period = Math.max(0.07, 0.45 - train.speed / 900);
          if (ud.smokeClock > period) {
            ud.smokeClock = 0;
            const p = new THREE.Vector3();
            ud.chimney.getWorldPosition(p);
            this.emitPuff(p.add(new THREE.Vector3(0, 8, 0)));
          }
        }
      });
    }
    for (const [key, obj] of this.trainObjs) {
      if (!seen.has(key)) {
        this.trainGroup.remove(obj);
        this.trainObjs.delete(key);
      }
    }
  }

  emitPuff(pos) {
    let s = this.puffs.find((p) => !p.visible);
    if (!s) {
      if (this.puffs.length > 120) return;
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.smokeTexture(), transparent: true, depthWrite: false, opacity: 0.8 }));
      this.puffs.push(s);
      this.fxGroup.add(s);
    }
    s.visible = true;
    s.position.copy(pos);
    s.userData.age = 0;
    s.userData.vx = (Math.random() - 0.5) * 8;
    s.userData.vz = (Math.random() - 0.5) * 8;
    s.scale.setScalar(10);
  }

  updatePuffs(dt) {
    for (const s of this.puffs) {
      if (!s.visible) continue;
      const u = s.userData;
      u.age += dt;
      if (u.age > 2.6) { s.visible = false; continue; }
      s.position.y += dt * 38;
      s.position.x += u.vx * dt;
      s.position.z += u.vz * dt;
      s.scale.setScalar(10 + u.age * 26);
      s.material.opacity = 0.75 * (1 - u.age / 2.6);
    }
  }

  updateCamera(dt) {
    const L = this.app.layout;
    if (this.camMode === 'orbit') {
      this.controls.update();
      return;
    }
    const train = L.trains.find((t) => t.id === this.app.activeTrain) || L.trains[0];
    if (!train) return;
    const cars = carPoses(L, train);
    if (!cars.length) return;
    const front = cars[0];
    const dir = new THREE.Vector3(Math.cos(front.a), 0, -Math.sin(front.a));
    const base = new THREE.Vector3(front.x, front.z + 10, -front.y);
    if (this.camMode === 'cab') {
      const pos = base.clone().addScaledVector(dir, front.length / 2 + 4).add(new THREE.Vector3(0, 30, 0));
      const look = pos.clone().addScaledVector(dir, 400).add(new THREE.Vector3(0, -10, 0));
      this.camera.position.copy(pos);
      this.camera.lookAt(look);
    } else {
      const want = base.clone().addScaledVector(dir, -380).add(new THREE.Vector3(0, 170, 0));
      const k = 1 - Math.exp(-dt * 3);
      this.camera.position.lerp(want, k);
      const look = base.clone().addScaledVector(dir, 150);
      this._look = this._look ? this._look.lerp(look, k) : look;
      this.camera.lookAt(this._look);
    }
  }

  onClick(e) {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 5) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = [this.terrainMesh, this.ballastMesh].filter(Boolean);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return;
    const x = hit.point.x, y = -hit.point.z;
    const tp = nearestTrackPoint(this.app.layout, x, y, 40);
    if (tp) {
      const piece = this.app.layout.pieces.find((p) => p.id === tp.pid);
      if (piece && isSwitchable(pieceGeometry(piece))) toggleSwitch(this.app, piece.id);
    }
  }

  frame(dt) {
    if (!this.visible) return;
    const now = performance.now();
    if (this.liveDirty && now - this.lastLive > 180) {
      this.liveDirty = false;
      this.lastLive = now;
      this.dirtyStatic = true;
      this.dirtyScenery = true;
    }
    if (this.dirtyStatic) { this.rebuildStatic(); this.dirtyStatic = false; }
    if (this.dirtyScenery) { this.buildScenery(); this.dirtyScenery = false; }
    if (this.water) {
      const m = this.water.material.normalMap;
      m.offset.x = (m.offset.x + dt * 0.01) % 1;
      m.offset.y = (m.offset.y + dt * 0.006) % 1;
    }
    this.updateTrains(dt);
    this.updatePuffs(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

// Cross-section of a single-track vault: [lateral offset, height].
function vaultProfile() {
  const hw = VAULT_HALF_WIDTH, H = VAULT_HEIGHT;
  const pts = [[hw, -1], [hw, H - hw]];
  for (let i = 1; i < 10; i++) {
    const t = (i / 10) * Math.PI;
    pts.push([Math.cos(t) * hw, H - hw + Math.sin(t) * hw]);
  }
  pts.push([-hw, H - hw], [-hw, -1], [hw, -1.3]);
  return pts;
}
