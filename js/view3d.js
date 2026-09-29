// 3D view (three.js): terrain, tracks, scenery and trains.
// Plan coordinates (x, y, height z) map to three.js (x, z, -y).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pieceGeometry, isSwitchable, GAUGE } from './catalog/tracks.js';
import { sceneryType } from './catalog/scenery.js';
import { stock } from './catalog/rolling-stock.js';
import { routePose, terrainHeight, worldEndpoints, PAINTS, WATER_LEVEL } from './model.js';
import { carPoses, nearestTrackPoint } from './sim.js';
import { toggleSwitch } from './editor.js';
import { buildScenery, buildStock, mat } from './models3d.js';

const BALLAST_Z = 3;       // top of ballast above track base height
const RAIL_BASE = 3.8;     // bottom of rail
const RAIL_H = 2.2;        // code 100 ≈ 2.5 mm
const BOARD_BOTTOM = -180;

export class View3D {
  constructor(app, container) {
    this.app = app;
    this.container = container;
    this.visible = true;
    this.camMode = 'orbit';

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b9d3e8');
    scene.fog = new THREE.Fog('#b9d3e8', 6000, 16000);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(45, 1, 5, 40000);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight('#dfefff', '#5a5040', 1.4));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.8;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshStandardMaterial({ color: '#8d8f86', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -760;
    floor.receiveShadow = true;
    scene.add(floor);

    this.boardGroup = new THREE.Group();
    this.trackGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.trainGroup = new THREE.Group();
    scene.add(this.boardGroup, this.trackGroup, this.sceneryGroup, this.trainGroup);
    this.trainObjs = new Map();

    this.dirtyTerrain = true;
    this.dirtyTracks = true;
    this.dirtyScenery = true;
    app.on('layout', () => { this.dirtyTracks = true; this.dirtyScenery = true; });
    app.on('layout-live', () => { this.dirtyTracks = true; this.dirtyScenery = true; });
    app.on('terrain', () => { this.dirtyTerrain = true; this.dirtyScenery = true; this.dirtyTracks = true; });
    app.on('terrain-live', () => { this.terrainLive = true; });
    app.on('switch', () => { this.dirtyTracks = true; });

    this.raycaster = new THREE.Raycaster();
    renderer.domElement.addEventListener('pointerdown', (e) => { this.downAt = { x: e.clientX, y: e.clientY }; });
    renderer.domElement.addEventListener('pointerup', (e) => this.onClick(e));

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.resetCamera();
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
    const span = Math.max(b.w, b.d);
    this.camera.position.set(cx - span * 0.1, span * 0.75, cz + span * 0.85);
    this.controls.target.set(cx, 0, cz);
    this.controls.update();
    this.updateSun();
  }

  updateSun() {
    const b = this.app.layout.board;
    const cx = b.w / 2, cz = -b.d / 2;
    const span = Math.max(b.w, b.d);
    this.sun.position.set(cx - span * 0.4, span * 1.2, cz + span * 0.6);
    this.sun.target.position.set(cx, 0, cz);
    const cam = this.sun.shadow.camera;
    cam.left = -span * 0.8; cam.right = span * 0.8; cam.top = span * 0.8; cam.bottom = -span * 0.8;
    cam.near = 10; cam.far = span * 4;
    cam.updateProjectionMatrix();
  }

  setCamMode(mode) {
    this.camMode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      // keep the current view as the orbit start
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.controls.target.copy(this.camera.position).addScaledVector(dir, 600);
      this.controls.update();
    }
    this.app.emit('cammode', mode);
  }

  // ---------------------------------------------------------------- terrain
  buildTerrain() {
    const g = this.boardGroup;
    for (const c of [...g.children]) { g.remove(c); c.geometry?.dispose(); }
    const L = this.app.layout;
    const T = L.terrain;
    const { nx, ny, cell, heights, paint } = T;
    const pos = new Float32Array(nx * ny * 3);
    const col = new Float32Array(nx * ny * 3);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = Math.min(i * cell, L.board.w);
        pos[k * 3 + 1] = heights[k];
        pos[k * 3 + 2] = -Math.min(j * cell, L.board.d);
        const c = PAINTS[paint[k]]?.color || PAINTS[0].color;
        const lift = Math.max(-0.2, Math.min(0.25, heights[k] / 500));
        col[k * 3] = Math.pow((c[0] / 255) * (1 + lift), 2.2);
        col[k * 3 + 1] = Math.pow((c[1] / 255) * (1 + lift), 2.2);
        col[k * 3 + 2] = Math.pow((c[2] / 255) * (1 + lift), 2.2);
      }
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    terrain.name = 'terrain';
    g.add(terrain);
    this.terrainMesh = terrain;

    // board sides
    const side = [];
    const edge = (pts) => {
      for (let n = 0; n < pts.length - 1; n++) {
        const [a, b] = [pts[n], pts[n + 1]];
        side.push(a.x, a.h, a.z, b.x, b.h, b.z, a.x, BOARD_BOTTOM, a.z);
        side.push(b.x, b.h, b.z, b.x, BOARD_BOTTOM, b.z, a.x, BOARD_BOTTOM, a.z);
      }
    };
    const P = (i, j) => ({ x: pos[(j * nx + i) * 3], h: pos[(j * nx + i) * 3 + 1], z: pos[(j * nx + i) * 3 + 2] });
    const south = [], north = [], west = [], east = [];
    for (let i = 0; i < nx; i++) { south.push(P(i, 0)); north.push(P(nx - 1 - i, ny - 1)); }
    for (let j = 0; j < ny; j++) { east.push(P(nx - 1, j)); west.push(P(0, ny - 1 - j)); }
    edge(south); edge(east); edge(north); edge(west);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(side), 3));
    sg.computeVertexNormals();
    const sides = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#7b5a3c', roughness: 0.8, side: THREE.DoubleSide }));
    sides.castShadow = true;
    g.add(sides);
    // table legs
    for (const [x, z] of [[60, -60], [L.board.w - 60, -60], [60, -L.board.d + 60], [L.board.w - 60, -L.board.d + 60]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(50, 580, 50), mat('#5d4430'));
      leg.position.set(x, BOARD_BOTTOM - 290, z);
      leg.castShadow = true;
      g.add(leg);
    }
    // water
    let minH = Infinity;
    for (const h of heights) minH = Math.min(minH, h);
    if (minH < WATER_LEVEL) {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(L.board.w, L.board.d),
        new THREE.MeshStandardMaterial({ color: '#3d6f96', transparent: true, opacity: 0.72, roughness: 0.1, metalness: 0.2 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(L.board.w / 2, WATER_LEVEL, -L.board.d / 2);
      water.receiveShadow = true;
      g.add(water);
    }
    this.updateSun();
  }

  // Fast path while sculpting: only update the heights of the mesh.
  updateTerrainHeights() {
    const m = this.terrainMesh;
    if (!m) return this.buildTerrain();
    const T = this.app.layout.terrain;
    const pos = m.geometry.attributes.position;
    if (pos.count !== T.nx * T.ny) return this.buildTerrain();
    for (let k = 0; k < pos.count; k++) pos.array[k * 3 + 1] = T.heights[k];
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    // repaint colours too (paint brush)
    const col = m.geometry.attributes.color;
    for (let k = 0; k < pos.count; k++) {
      const c = PAINTS[T.paint[k]]?.color || PAINTS[0].color;
      const lift = Math.max(-0.2, Math.min(0.25, T.heights[k] / 500));
      col.array[k * 3] = Math.pow((c[0] / 255) * (1 + lift), 2.2);
      col.array[k * 3 + 1] = Math.pow((c[1] / 255) * (1 + lift), 2.2);
      col.array[k * 3 + 2] = Math.pow((c[2] / 255) * (1 + lift), 2.2);
    }
    col.needsUpdate = true;
  }

  // ----------------------------------------------------------------- tracks
  buildTracks() {
    const g = this.trackGroup;
    for (const c of [...g.children]) { g.remove(c); c.geometry?.dispose(); }
    const L = this.app.layout;
    const ballast = [], rails = [], railsOff = [];
    const sleepers = [];
    const piers = [];
    const extras = [];
    const T = L.terrain;
    const pushQuad = (arr, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); };
    const V = (p, off, dz) => [p.x - Math.sin(p.a) * off, p.z + dz, -(p.y + Math.cos(p.a) * off)];

    for (const piece of L.pieces) {
      const geo = pieceGeometry(piece);
      if (!geo) continue;
      const active = geo.states[piece.state || 0] || geo.states[0];
      for (const r of geo.routes) {
        const n = Math.max(2, Math.ceil(r.len / 6));
        const pts = [];
        for (let i = 0; i <= n; i++) pts.push(routePose(piece, geo, r, (r.len * i) / n));
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[i + 1];
          // ballast: slopes and top
          pushQuad(ballast, V(a, 19, 0), V(b, 19, 0), V(b, 14, BALLAST_Z), V(a, 14, BALLAST_Z));
          pushQuad(ballast, V(a, 14, BALLAST_Z), V(b, 14, BALLAST_Z), V(b, -14, BALLAST_Z), V(a, -14, BALLAST_Z));
          pushQuad(ballast, V(a, -14, BALLAST_Z), V(b, -14, BALLAST_Z), V(b, -19, 0), V(a, -19, 0));
          // rails
          const target = active.includes(r.idx) || !isSwitchable(geo) ? rails : railsOff;
          for (const off of [GAUGE / 2, -GAUGE / 2]) {
            const t0 = RAIL_BASE + RAIL_H;
            pushQuad(target, V(a, off + 0.6, t0), V(b, off + 0.6, t0), V(b, off - 0.6, t0), V(a, off - 0.6, t0));
            pushQuad(target, V(a, off + 0.6, RAIL_BASE), V(b, off + 0.6, RAIL_BASE), V(b, off + 0.6, t0), V(a, off + 0.6, t0));
            pushQuad(target, V(a, off - 0.6, t0), V(b, off - 0.6, t0), V(b, off - 0.6, RAIL_BASE), V(a, off - 0.6, RAIL_BASE));
          }
        }
        // sleepers
        const ns = Math.floor(r.len / 7.5);
        for (let i = 0; i < ns; i++) {
          const p = routePose(piece, geo, r, (r.len * (i + 0.5)) / ns);
          sleepers.push(p);
        }
        // piers under elevated track
        const np = Math.max(1, Math.round(r.len / 140));
        for (let i = 0; i <= np; i++) {
          const p = routePose(piece, geo, r, (r.len * i) / np);
          const ground = terrainHeight(T, p.x, p.y);
          if (p.z - ground > 14) piers.push({ x: p.x, y: p.y, a: p.a, top: p.z, bottom: ground });
        }
      }
      // turnout motors and buffer stops
      if (geo.electric) {
        const e = worldEndpoints(piece)[0];
        const inward = e.a + Math.PI;
        const side = geo.hand && geo.hand < 0 ? 1 : -1;
        extras.push({ kind: 'motor', x: e.x + Math.cos(inward) * 25 - Math.sin(inward) * 26 * side, y: e.y + Math.sin(inward) * 25 + Math.cos(inward) * 26 * side, z: e.z, a: inward });
      }
      if (geo.kind === 'buffer') {
        const e = worldEndpoints(piece).find((x) => x.buffer);
        extras.push({ kind: 'buffer', x: e.x, y: e.y, z: e.z, a: e.a });
      }
    }
    const mk = (arr, material) => {
      if (!arr.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material);
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    this.ballastMesh = mk(ballast, new THREE.MeshStandardMaterial({ color: '#7c756b', roughness: 1, side: THREE.DoubleSide }));
    if (this.ballastMesh) this.ballastMesh.castShadow = true;
    mk(rails, new THREE.MeshStandardMaterial({ color: '#b8b8bc', metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }));
    mk(railsOff, new THREE.MeshStandardMaterial({ color: '#8d8a86', metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));

    if (sleepers.length) {
      const sg = new THREE.BoxGeometry(2.6, 1.0, 26);
      const im = new THREE.InstancedMesh(sg, mat('#4a3a2c'), sleepers.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      sleepers.forEach((p, i) => {
        q.setFromAxisAngle(up, p.a);
        v.set(p.x, p.z + BALLAST_Z + 0.4, -p.y);
        m4.compose(v, q, s);
        im.setMatrixAt(i, m4);
      });
      im.receiveShadow = true;
      g.add(im);
    }
    if (piers.length) {
      const pg = new THREE.BoxGeometry(16, 1, 34);
      const im = new THREE.InstancedMesh(pg, mat('#9a948a'), piers.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      piers.forEach((p, i) => {
        const h = p.top - p.bottom;
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
    for (const x of extras) {
      let m;
      if (x.kind === 'motor') {
        m = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 14), mat('#3b3b3b'));
        m.position.set(x.x, x.z + 5, -x.y);
      } else {
        m = new THREE.Group();
        const beam = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 30), mat('#b0322a'));
        beam.position.set(-4, 14, 0);
        const post = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 22), mat('#3a3a3a'));
        post.position.set(-10, 8, 0);
        post.rotation.z = -0.5;
        m.add(beam, post);
        m.position.set(x.x, x.z, -x.y);
      }
      m.rotation.y = x.a;
      m.castShadow = true;
      g.add(m);
    }
  }

  // ---------------------------------------------------------------- scenery
  buildScenery() {
    const g = this.sceneryGroup;
    for (const c of [...g.children]) g.remove(c);
    const L = this.app.layout;
    for (const s of L.scenery) {
      const st = sceneryType(s.kind);
      if (!st) continue;
      const obj = buildScenery(st);
      // sit on the lowest terrain point of the footprint (avoid floating)
      let z = Infinity;
      const k = s.scale || 1;
      for (const [dx, dy] of [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
        const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
        const lx = dx * st.w * k, ly = dy * st.d * k;
        z = Math.min(z, terrainHeight(L.terrain, s.x + lx * c - ly * sn, s.y + lx * sn + ly * c));
      }
      if (s.z != null) z = s.z;
      obj.position.set(s.x, z, -s.y);
      obj.rotation.y = s.rot || 0;
      obj.scale.setScalar(k);
      g.add(obj);
    }
  }

  // ----------------------------------------------------------------- trains
  updateTrains() {
    const L = this.app.layout;
    const seen = new Set();
    for (const train of L.trains) {
      const cars = carPoses(L, train);
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
      });
    }
    for (const [key, obj] of this.trainObjs) {
      if (!seen.has(key)) {
        this.trainGroup.remove(obj);
        this.trainObjs.delete(key);
      }
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
      const want = base.clone().addScaledVector(dir, -420).add(new THREE.Vector3(0, 190, 0));
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
    if (this.dirtyTerrain) { this.buildTerrain(); this.dirtyTerrain = false; this.terrainLive = false; }
    if (this.terrainLive) { this.updateTerrainHeights(); this.terrainLive = false; this.dirtyScenery = true; }
    if (this.dirtyTracks) { this.buildTracks(); this.dirtyTracks = false; }
    if (this.dirtyScenery) { this.buildScenery(); this.dirtyScenery = false; }
    this.updateTrains();
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
