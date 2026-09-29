// 2D plan view: drawing and mouse/keyboard interaction on a <canvas>.

import { pieceGeometry, isSwitchable, BED_WIDTH, GAUGE } from './catalog/tracks.js';
import { sceneryType } from './catalog/scenery.js';
import {
  worldEndpoints, routePose, openEndpoints, findPiece, applyBrush, terrainHeight,
  PAINTS, WATER_LEVEL,
} from './model.js';
import { carPoses, nearestTrackPoint } from './sim.js';
import {
  ghostPlacement, placeGhost, moveSelection, snapSelection, connectedComponent,
  toggleSwitch, addScenery, addTrain,
} from './editor.js';
import { toLocal } from './geom.js';
import { t } from './i18n.js';

const SAMPLE_STEP = 8;

export class PlanView {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { cx: 1200, cy: 600, scale: 0.4 };
    this.cache = new Map();
    this.terrainImg = null;
    this.terrainDirty = true;
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
    this.drag = null;
    this.dirty = true;
    this.hoverTrack = null;

    app.on('layout', () => this.invalidate());
    app.on('terrain', () => { this.terrainDirty = true; this.invalidate(); });
    app.on('selection', () => this.invalidate());
    app.on('tool', () => this.invalidate());
    app.on('switch', () => this.invalidate());

    this.bindEvents();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  invalidate() {
    this.dirty = true;
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(10, r.width);
    this.h = Math.max(10, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.dpr = dpr;
    if (!this.userView && this.w > 50) this.fit();
    this.invalidate();
  }

  fit() {
    const b = this.app.layout.board;
    const s = Math.min((this.w - 40) / b.w, (this.h - 40) / b.d);
    this.view = { cx: b.w / 2, cy: b.d / 2, scale: Math.max(0.02, s) };
    this.userView = false;
    this.invalidate();
  }

  toScreen(x, y) {
    const v = this.view;
    return { x: (x - v.cx) * v.scale + this.w / 2, y: this.h / 2 - (y - v.cy) * v.scale };
  }

  toWorld(sx, sy) {
    const v = this.view;
    return { x: (sx - this.w / 2) / v.scale + v.cx, y: (this.h / 2 - sy) / v.scale + v.cy };
  }

  // ------------------------------------------------------------------ cache
  piecePaths(p) {
    const key = `${p.ref}|${p.x}|${p.y}|${p.rot}|${p.len || ''}|${p.h?.join(',')}`;
    const c = this.cache.get(p.id);
    if (c && c.key === key) return c;
    const g = pieceGeometry(p);
    const routes = g.routes.map((r) => {
      const n = Math.max(2, Math.ceil(r.len / SAMPLE_STEP));
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(routePose(p, g, r, (r.len * i) / n));
      return { idx: r.idx, pts, len: r.len };
    });
    let cx = 0, cy = 0, cnt = 0;
    for (const r of routes) for (const q of r.pts) { cx += q.x; cy += q.y; cnt++; }
    const zs = p.h || [0];
    const entry = { key, routes, g, cx: cx / cnt, cy: cy / cnt, zmin: Math.min(...zs), zmax: Math.max(...zs) };
    this.cache.set(p.id, entry);
    return entry;
  }

  // ------------------------------------------------------------------- draw
  draw() {
    const { ctx, app } = this;
    const L = app.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#23272e';
    ctx.fillRect(0, 0, this.w, this.h);

    // baseboard + terrain
    const b0 = this.toScreen(0, L.board.d);
    const bw = L.board.w * this.view.scale, bh = L.board.d * this.view.scale;
    ctx.fillStyle = '#6e8f55';
    ctx.fillRect(b0.x, b0.y, bw, bh);
    if (this.terrainDirty) this.buildTerrainImage();
    if (this.terrainImg) {
      ctx.imageSmoothingEnabled = true;
      const cell = L.terrain.cell;
      const tw = (L.terrain.nx - 1) * cell * this.view.scale;
      const th = (L.terrain.ny - 1) * cell * this.view.scale;
      const half = (cell * this.view.scale) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(b0.x, b0.y, bw, bh);
      ctx.clip();
      ctx.drawImage(this.terrainImg, b0.x - half, b0.y + bh - th - half, tw + 2 * half, th + 2 * half);
      ctx.restore();
    }
    if (app.showGrid) this.drawGrid();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(b0.x, b0.y, bw, bh);

    const flat = L.scenery.filter((s) => ['road', 'platform'].includes(s.kind));
    const tall = L.scenery.filter((s) => !['road', 'platform'].includes(s.kind));
    for (const s of flat) this.drawScenery(s);
    this.drawTracks();
    for (const s of tall) this.drawScenery(s);
    this.drawTrains();
    this.drawEndpoints();
    this.drawOverlay();
    this.dirty = false;
  }

  drawGrid() {
    const { ctx } = this;
    const L = this.app.layout;
    const sc = this.view.scale;
    let step = 100;
    if (sc * 100 < 12) step = 500;
    ctx.lineWidth = 1;
    for (let x = 0; x <= L.board.w; x += step) {
      const a = this.toScreen(x, 0), b = this.toScreen(x, L.board.d);
      ctx.strokeStyle = x % 500 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)';
      ctx.beginPath(); ctx.moveTo(Math.round(a.x) + 0.5, a.y); ctx.lineTo(Math.round(b.x) + 0.5, b.y); ctx.stroke();
    }
    for (let y = 0; y <= L.board.d; y += step) {
      const a = this.toScreen(0, y), b = this.toScreen(L.board.w, y);
      ctx.strokeStyle = y % 500 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)';
      ctx.beginPath(); ctx.moveTo(a.x, Math.round(a.y) + 0.5); ctx.lineTo(b.x, Math.round(b.y) + 0.5); ctx.stroke();
    }
  }

  buildTerrainImage() {
    const T = this.app.layout.terrain;
    const { nx, ny, heights, paint } = T;
    const cv = this.terrainImg && this.terrainImg.width === nx && this.terrainImg.height === ny
      ? this.terrainImg : Object.assign(document.createElement('canvas'), { width: nx, height: ny });
    const c = cv.getContext('2d');
    const img = c.createImageData(nx, ny);
    const cell = T.cell;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const h = heights[k];
        const hx = heights[j * nx + Math.min(nx - 1, i + 1)] - heights[j * nx + Math.max(0, i - 1)];
        const hy = heights[Math.min(ny - 1, j + 1) * nx + i] - heights[Math.max(0, j - 1) * nx + i];
        // hillshade: light from north-west
        const shade = Math.max(0.55, Math.min(1.35, 1 + (hx - hy) / (4 * cell) * 1.6));
        let [r, g, bl] = PAINTS[paint[k]]?.color || PAINTS[0].color;
        const lift = Math.max(-0.25, Math.min(0.15, h / 900));
        r = r * (1 + lift); g = g * (1 + lift); bl = bl * (1 + lift);
        if (h < WATER_LEVEL) {
          const depth = Math.min(1, (WATER_LEVEL - h) / 60);
          r = 70 - 30 * depth; g = 120 - 40 * depth; bl = 170 - 30 * depth;
        } else {
          r *= shade; g *= shade; bl *= shade;
        }
        // contour line every 25 mm
        const fr = Math.abs(h) % 25;
        if (Math.abs(h) > 1 && (fr < 1.2 || fr > 23.8)) { r *= 0.8; g *= 0.8; bl *= 0.8; }
        const o = ((ny - 1 - j) * nx + i) * 4; // flip vertically (y up)
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = bl; img.data[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    this.terrainImg = cv;
    this.terrainDirty = false;
  }

  pathOf(pts) {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const s = this.toScreen(pts[i].x, pts[i].y);
      if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
    }
  }

  offsetPts(pts, off) {
    return pts.map((p) => ({ x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off }));
  }

  drawTracks() {
    const { ctx, app } = this;
    const L = app.layout;
    const sc = this.view.scale;
    const entries = L.pieces.map((p) => ({ p, c: this.piecePaths(p) }));
    entries.sort((a, b) => a.c.zmax - b.c.zmax);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (const { p, c } of entries) {
      const selected = app.selection.has(`p:${p.id}`);
      const active = c.g.states[p.state || 0] || c.g.states[0];
      // selection glow
      if (selected) {
        ctx.strokeStyle = 'rgba(80,170,255,0.55)';
        ctx.lineWidth = (BED_WIDTH + 18) * sc;
        for (const r of c.routes) { this.pathOf(r.pts); ctx.stroke(); }
      }
      // ballast bed: darker when low, lighter when elevated
      const z = (c.zmin + c.zmax) / 2;
      const tint = Math.max(-40, Math.min(60, z * 0.6));
      ctx.strokeStyle = `rgb(${120 + tint},${112 + tint},${100 + tint})`;
      ctx.lineWidth = Math.max(1.5, BED_WIDTH * sc);
      for (const r of c.routes) { this.pathOf(r.pts); ctx.stroke(); }
      // sleepers
      if (sc > 1.1) {
        ctx.strokeStyle = '#4a3a2c';
        ctx.lineWidth = Math.max(1, 2.6 * sc);
        for (const r of c.routes) {
          const n = Math.floor(r.len / 8);
          const g = c.g;
          const route = g.routes[r.idx];
          for (let i = 0; i <= n; i++) {
            const q = routePose(p, g, route, (route.len * (i + 0.5)) / (n + 1));
            const dx = -Math.sin(q.a) * 13, dy = Math.cos(q.a) * 13;
            const a = this.toScreen(q.x + dx, q.y + dy), b = this.toScreen(q.x - dx, q.y - dy);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      // rails: inactive routes first
      const order = [...c.routes].sort((a, b) => (active.includes(a.idx) ? 1 : 0) - (active.includes(b.idx) ? 1 : 0));
      for (const r of order) {
        const on = active.includes(r.idx);
        if (sc > 0.35) {
          ctx.strokeStyle = on ? '#d8d8d8' : 'rgba(200,200,200,0.35)';
          ctx.lineWidth = Math.max(1, 1.4 * sc);
          for (const off of [GAUGE / 2, -GAUGE / 2]) { this.pathOf(this.offsetPts(r.pts, off)); ctx.stroke(); }
        } else {
          ctx.strokeStyle = on ? '#e6e6e6' : 'rgba(230,230,230,0.35)';
          ctx.lineWidth = 1.2;
          this.pathOf(r.pts); ctx.stroke();
        }
      }
      if (isSwitchable(c.g) && sc > 0.15) {
        // small indicator dot showing the switch state
        const r = c.routes.find((x) => active.includes(x.idx));
        const q = r.pts[Math.min(r.pts.length - 1, 3)];
        const s = this.toScreen(q.x, q.y);
        ctx.fillStyle = c.g.electric ? '#ffcc33' : '#ff9933';
        ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(2.5, 3 * sc), 0, 7); ctx.fill();
      }
    }
    // labels
    if (app.showRefs && sc > 0.25) {
      ctx.font = `${Math.max(9, Math.min(13, 9 * sc))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const { p, c } of entries) {
        const s = this.toScreen(c.cx, c.cy);
        let label = p.ref;
        if (c.zmax > 0.5 || c.zmin < -0.5) {
          label += c.zmin === c.zmax ? ` ▲${Math.round(c.zmin)}` : ` ▲${Math.round(c.zmin)}–${Math.round(c.zmax)}`;
        }
        const w = ctx.measureText(label).width + 6;
        ctx.fillStyle = 'rgba(20,24,30,0.72)';
        ctx.fillRect(s.x - w / 2, s.y - 8, w, 16);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, s.x, s.y);
      }
    }
  }

  drawEndpoints() {
    const { ctx, app } = this;
    const sc = this.view.scale;
    for (const e of openEndpoints(app.layout)) {
      const s = this.toScreen(e.x, e.y);
      ctx.fillStyle = '#e5484d';
      ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(3.5, 5 * sc), 0, 7); ctx.fill();
    }
    // buffers
    for (const p of app.layout.pieces) {
      const g = pieceGeometry(p);
      if (g.kind !== 'buffer') continue;
      for (const e of worldEndpoints(p)) {
        if (!e.buffer) continue;
        const dx = -Math.sin(e.a) * 14, dy = Math.cos(e.a) * 14;
        const a = this.toScreen(e.x + dx, e.y + dy), b = this.toScreen(e.x - dx, e.y - dy);
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = Math.max(2, 5 * sc);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // chaining anchor
    if (app.anchor) {
      const p = findPiece(app.layout, app.anchor.pid);
      if (p) {
        const e = worldEndpoints(p)[app.anchor.ep];
        const s = this.toScreen(e.x, e.y);
        const pulse = 1 + 0.25 * Math.sin(performance.now() / 180);
        ctx.strokeStyle = '#3fb8ff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y, 10 * pulse, 0, 7); ctx.stroke();
        const tip = this.toScreen(e.x + Math.cos(e.a) * 60 / Math.max(sc, 0.3) * 0.3, e.y + Math.sin(e.a) * 60 / Math.max(sc, 0.3) * 0.3);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        this.dirty = true; // keep animating
      }
    }
  }

  drawScenery(s) {
    const { ctx, app } = this;
    const st = sceneryType(s.kind);
    if (!st) return;
    const sc = this.view.scale * (s.scale || 1);
    const c = this.toScreen(s.x, s.y);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(-(s.rot || 0));
    const w = st.w * sc, d = st.d * sc;
    const selected = app.selection.has(`s:${s.id}`);
    if (st.shape === 'circle') {
      ctx.fillStyle = st.color;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(2, w / 2), 0, 7); ctx.fill();
      if (s.kind === 'tree' || s.kind === 'conifer') {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(-w * 0.12, d * 0.12, w / 4, 0, 7); ctx.fill();
      }
    } else {
      ctx.fillStyle = st.color;
      ctx.fillRect(-w / 2, -d / 2, w, d);
      if (st.roof) {
        ctx.fillStyle = st.roof;
        ctx.fillRect(-w / 2 + 2 * sc, -d / 2 + 2 * sc, w - 4 * sc, d - 4 * sc);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 2 * sc, 0); ctx.lineTo(w / 2 - 2 * sc, 0); ctx.stroke();
      }
      if (s.kind === 'road') {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.setLineDash([10 * sc, 8 * sc]);
        ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (s.kind === 'tunnel') {
        ctx.fillStyle = '#222';
        ctx.fillRect(-w * 0.28, -d / 2, w * 0.56, d * 0.35);
      }
    }
    if (st.tower) {
      ctx.fillStyle = '#6b6f78';
      ctx.fillRect(w / 2 - 36 * sc, -18 * sc, 36 * sc, 36 * sc);
    }
    if (st.chimney) {
      ctx.fillStyle = '#7a3f2e';
      ctx.beginPath(); ctx.arc(w / 2 - 20 * sc, d / 2 - 20 * sc, 10 * sc, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = selected ? '#3fb8ff' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = selected ? 3 : 1;
    if (st.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, Math.max(2, w / 2), 0, 7); ctx.stroke(); } else ctx.strokeRect(-w / 2, -d / 2, w, d);
    ctx.restore();
  }

  drawTrains() {
    const { ctx, app } = this;
    const sc = this.view.scale;
    for (const train of app.layout.trains) {
      const cars = carPoses(app.layout, train);
      const active = train.id === app.activeTrain;
      for (const car of cars) {
        const st = car.st;
        const s = this.toScreen(car.x, car.y);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(-car.a);
        const L = (car.length - 4) * sc, W = 30 * sc;
        ctx.fillStyle = st?.color || '#888';
        ctx.fillRect(-L / 2, -W / 2, L, W);
        if (st?.color2 && st.kind !== 'loco') {
          ctx.fillStyle = st.color2;
          ctx.fillRect(-L / 2, -W / 2, L, W * 0.35);
        }
        if (st?.kind === 'loco') {
          // mark the loco front
          ctx.fillStyle = '#ffd34d';
          const fx = car.flip ? -L / 2 : L / 2;
          ctx.beginPath();
          ctx.moveTo(fx, 0);
          ctx.lineTo(fx - Math.sign(fx) * Math.min(18 * sc, L / 3), -W / 2.5);
          ctx.lineTo(fx - Math.sign(fx) * Math.min(18 * sc, L / 3), W / 2.5);
          ctx.fill();
        }
        ctx.strokeStyle = active ? '#3fb8ff' : '#111';
        ctx.lineWidth = active ? 2 : 1;
        ctx.strokeRect(-L / 2, -W / 2, L, W);
        ctx.restore();
      }
      if (cars.length && sc > 0.12) {
        const c = cars[0];
        const s = this.toScreen(c.x, c.y);
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const label = train.name;
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = active ? 'rgba(20,110,170,0.9)' : 'rgba(0,0,0,0.65)';
        ctx.fillRect(s.x - w / 2, s.y - 30, w, 16);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, s.x, s.y - 22);
      }
    }
  }

  drawGhostPiece(ref, pl, color) {
    const { ctx } = this;
    const tmp = { ref, x: pl.x, y: pl.y, rot: pl.rot, h: [] };
    const g = pieceGeometry(tmp);
    const sc = this.view.scale;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, BED_WIDTH * sc);
    ctx.lineCap = 'butt';
    for (const r of g.routes) {
      const pts = [];
      const n = Math.max(2, Math.ceil(r.len / SAMPLE_STEP));
      for (let i = 0; i <= n; i++) pts.push(routePose(tmp, g, r, (r.len * i) / n));
      this.pathOf(pts); ctx.stroke();
    }
    // mark connecting end
    const e = worldEndpoints({ ...tmp, h: g.endpoints.map(() => 0) })[pl.ep];
    const s = this.toScreen(e.x, e.y);
    ctx.fillStyle = '#3fb8ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, 7); ctx.fill();
  }

  drawOverlay() {
    const { ctx, app } = this;
    const m = this.mouse;
    if (!m.inside && !this.drag) return;
    const sc = this.view.scale;
    if (app.tool === 'track' && app.trackRef && !app.anchor) {
      const pl = ghostPlacement(app, app.trackRef, m.x, m.y, 40 / sc);
      this.drawGhostPiece(app.trackRef, pl, pl.snapped ? 'rgba(63,184,255,0.55)' : 'rgba(255,255,255,0.4)');
    }
    if (app.tool === 'terrain') {
      const s = this.toScreen(m.x, m.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, app.brush.radius * sc, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x, s.y, app.brush.radius * sc * 0.5, 0, 7);
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      const h = terrainHeight(app.layout.terrain, m.x, m.y);
      ctx.fillStyle = '#fff';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${h.toFixed(0)} mm`, s.x + app.brush.radius * sc + 6, s.y);
    }
    if (app.tool === 'scenery' && app.sceneryId) {
      ctx.globalAlpha = 0.6;
      this.drawScenery({ id: -1, kind: app.sceneryId, x: m.x, y: m.y, rot: app.sceneryRot, scale: 1 });
      ctx.globalAlpha = 1;
    }
    if (app.tool === 'train') {
      const hit = nearestTrackPoint(app.layout, m.x, m.y, 40 / Math.max(sc, 0.2));
      this.hoverTrack = hit;
      if (hit) {
        const p = findPiece(app.layout, hit.pid);
        const g = pieceGeometry(p);
        const pose = routePose(p, g, g.routes[hit.ri], hit.s);
        const a = pose.a + (app.trainDir < 0 ? Math.PI : 0);
        const s = this.toScreen(pose.x, pose.y);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(-a);
        ctx.fillStyle = '#3fb8ff';
        ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-8, -12); ctx.lineTo(-8, 12); ctx.fill();
        ctx.restore();
      }
    }
    if (this.drag?.type === 'marquee') {
      const a = this.toScreen(this.drag.x0, this.drag.y0), b = this.toScreen(m.x, m.y);
      ctx.strokeStyle = '#3fb8ff';
      ctx.fillStyle = 'rgba(63,184,255,0.12)';
      ctx.lineWidth = 1;
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
  }

  // ------------------------------------------------------------ hit testing
  pickPiece(x, y) {
    const tol = Math.max(BED_WIDTH / 2, 8 / this.view.scale);
    let best = null;
    for (const p of this.app.layout.pieces) {
      const c = this.piecePaths(p);
      for (const r of c.routes) {
        for (const q of r.pts) {
          const d = Math.hypot(q.x - x, q.y - y);
          if (d < tol && (!best || d < best.d || (d === best.d && c.zmax > best.z))) best = { p, d, z: c.zmax };
        }
      }
    }
    return best?.p || null;
  }

  pickScenery(x, y) {
    const list = this.app.layout.scenery;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const st = sceneryType(s.kind);
      if (!st) continue;
      const loc = toLocal({ x: s.x, y: s.y, rot: s.rot || 0 }, { x, y });
      const k = s.scale || 1;
      const pad = 4 / this.view.scale;
      if (st.shape === 'circle') {
        if (Math.hypot(loc.x, loc.y) < (st.w / 2) * k + pad) return s;
      } else if (Math.abs(loc.x) < (st.w / 2) * k + pad && Math.abs(loc.y) < (st.d / 2) * k + pad) return s;
    }
    return null;
  }

  pickTrain(x, y) {
    for (const train of this.app.layout.trains) {
      for (const car of carPoses(this.app.layout, train)) {
        const loc = toLocal({ x: car.x, y: car.y, rot: car.a }, { x, y });
        if (Math.abs(loc.x) < car.length / 2 && Math.abs(loc.y) < 18) return train;
      }
    }
    return null;
  }

  pickOpenEnd(x, y) {
    const tol = Math.max(10, 9 / this.view.scale);
    let best = null;
    for (const e of openEndpoints(this.app.layout)) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < tol && (!best || d < best.d)) best = { e, d };
    }
    return best?.e || null;
  }

  // ----------------------------------------------------------------- events
  bindEvents() {
    const cv = this.canvas;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const before = this.toWorld(sx, sy);
      const f = Math.exp(-e.deltaY * 0.0015);
      this.userView = true;
      this.view.scale = Math.min(12, Math.max(0.03, this.view.scale * f));
      const after = this.toWorld(sx, sy);
      this.view.cx += before.x - after.x;
      this.view.cy += before.y - after.y;
      this.invalidate();
    }, { passive: false });

    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    cv.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('pointerleave', () => { this.mouse.inside = false; this.invalidate(); });
    cv.addEventListener('pointerenter', () => { this.mouse.inside = true; });
    cv.addEventListener('dblclick', (e) => this.onDblClick(e));

    // touch pinch zoom
    this.pointers = new Map();
  }

  eventPos(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const w = this.toWorld(sx, sy);
    return { sx, sy, x: w.x, y: w.y };
  }

  onDown(e) {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pos = this.eventPos(e);
    Object.assign(this.mouse, pos, { inside: true });
    const app = this.app;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.userView = true;
      this.drag = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), scale0: this.view.scale };
      return;
    }
    // pan with middle/right button or space
    if (e.button === 1 || e.button === 2 || this.spaceDown) {
      this.userView = true;
      this.drag = { type: 'pan', sx: pos.sx, sy: pos.sy, cx: this.view.cx, cy: this.view.cy };
      return;
    }
    if (e.button !== 0) return;
    const tool = app.tool;
    if (tool === 'track' && app.trackRef && !app.anchor) {
      const pl = ghostPlacement(app, app.trackRef, pos.x, pos.y, 40 / this.view.scale);
      placeGhost(app, app.trackRef, pl);
      return;
    }
    if (tool === 'terrain') {
      this.drag = { type: 'terrain', target: terrainHeight(app.layout.terrain, pos.x, pos.y), last: performance.now() };
      this.paintAt(pos.x, pos.y, 1);
      return;
    }
    if (tool === 'scenery' && app.sceneryId) {
      addScenery(app, app.sceneryId, pos.x, pos.y, app.sceneryRot);
      return;
    }
    if (tool === 'train') {
      const hit = nearestTrackPoint(app.layout, pos.x, pos.y, 40 / Math.max(this.view.scale, 0.2));
      if (hit && app.consist.length) {
        const tr = addTrain(app, app.consist, { pid: hit.pid, ri: hit.ri, s: hit.s, dir: app.trainDir });
        if (!tr) app.emit('toast', t('evNoRoom'));
        else app.setTool('select');
      }
      return;
    }
    if (tool === 'operate') {
      const p = this.pickPiece(pos.x, pos.y);
      if (p && toggleSwitch(app, p.id)) return;
      const tr = this.pickTrain(pos.x, pos.y);
      if (tr) { app.activeTrain = tr.id; app.emit('trains'); this.invalidate(); }
      return;
    }
    // select tool
    const end = this.pickOpenEnd(pos.x, pos.y);
    if (end) {
      app.anchor = { pid: end.pid, ep: end.i };
      app.lastChained = null;
      app.select([`p:${end.pid}`]);
      app.emit('tool');
      return;
    }
    const train = this.pickTrain(pos.x, pos.y);
    const scen = !train && this.pickScenery(pos.x, pos.y);
    const piece = !train && !scen && this.pickPiece(pos.x, pos.y);
    const key = train ? `t:${train.id}` : scen ? `s:${scen.id}` : piece ? `p:${piece.id}` : null;
    if (train) { app.activeTrain = train.id; app.emit('trains'); }
    if (key) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) app.toggleSelect(key);
      else if (!app.selection.has(key)) app.select([key]);
      if (app.anchor && !(piece && piece.id === app.anchor.pid)) { app.anchor = null; app.emit('tool'); }
      if (!train) this.drag = { type: 'move', x0: pos.x, y0: pos.y, lx: pos.x, ly: pos.y, moved: false };
    } else {
      if (!(e.shiftKey || e.ctrlKey || e.metaKey)) app.clearSelection();
      if (app.anchor) { app.anchor = null; app.emit('tool'); }
      this.drag = { type: 'marquee', x0: pos.x, y0: pos.y, add: e.shiftKey || e.ctrlKey || e.metaKey };
    }
  }

  onMove(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pos = this.eventPos(e);
    Object.assign(this.mouse, pos, { inside: true });
    this.app.emit('cursor', pos);
    const d = this.drag;
    if (d?.type === 'pinch' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.view.scale = Math.min(12, Math.max(0.03, d.scale0 * Math.hypot(a.x - b.x, a.y - b.y) / d.d0));
    } else if (d?.type === 'pan') {
      this.view.cx = d.cx - (pos.sx - d.sx) / this.view.scale;
      this.view.cy = d.cy + (pos.sy - d.sy) / this.view.scale;
    } else if (d?.type === 'move') {
      const dx = pos.x - d.lx, dy = pos.y - d.ly;
      if (!d.moved && Math.hypot(pos.x - d.x0, pos.y - d.y0) * this.view.scale < 4) return;
      d.moved = true;
      moveSelection(this.app, dx, dy);
      d.lx = pos.x; d.ly = pos.y;
      this.app.emit('layout-live');
    } else if (d?.type === 'terrain') {
      this.paintAt(pos.x, pos.y, 1);
    }
    this.invalidate();
  }

  onUp(e) {
    this.pointers.delete(e.pointerId);
    const d = this.drag;
    this.drag = null;
    const app = this.app;
    if (!d) return;
    if (d.type === 'move' && d.moved) {
      snapSelection(app, 14 / this.view.scale + 6);
      app.commit();
    } else if (d.type === 'terrain') {
      app.commit({ terrain: true });
    } else if (d.type === 'marquee') {
      const m = this.mouse;
      const x0 = Math.min(d.x0, m.x), x1 = Math.max(d.x0, m.x);
      const y0 = Math.min(d.y0, m.y), y1 = Math.max(d.y0, m.y);
      if ((x1 - x0) * this.view.scale > 4 || (y1 - y0) * this.view.scale > 4) {
        const keys = [];
        for (const p of app.layout.pieces) {
          const c = this.piecePaths(p);
          if (c.cx >= x0 && c.cx <= x1 && c.cy >= y0 && c.cy <= y1) keys.push(`p:${p.id}`);
        }
        for (const s of app.layout.scenery) if (s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) keys.push(`s:${s.id}`);
        app.select(keys, d.add);
      }
    }
    this.invalidate();
  }

  onDblClick(e) {
    const app = this.app;
    if (app.tool !== 'select') return;
    const pos = this.eventPos(e);
    const p = this.pickPiece(pos.x, pos.y);
    if (p) app.select(connectedComponent(app, p.id).map((id) => `p:${id}`));
  }

  paintAt(x, y, k) {
    const app = this.app;
    const now = performance.now();
    const dt = this.drag ? Math.min(0.1, (now - this.drag.last) / 1000) : 0.016;
    if (this.drag) this.drag.last = now;
    const b = app.brush;
    const strength = b.mode === 'paint' ? 1 : b.strength * Math.max(0.3, dt * 30) * k;
    const changed = applyBrush(app.layout.terrain, x, y, {
      radius: b.radius, strength, mode: b.mode, target: this.drag?.target ?? 0, paint: b.paint,
    });
    if (changed) {
      this.terrainDirty = true;
      app.emit('terrain-live');
    }
  }

  // continuous painting while the mouse button is held still
  tick() {
    if (this.drag?.type === 'terrain' && ['raise', 'lower', 'smooth', 'flatten'].includes(this.app.brush.mode)) {
      this.paintAt(this.mouse.x, this.mouse.y, 0.5);
      this.invalidate();
    }
    if (this.dirty) this.draw();
  }
}
