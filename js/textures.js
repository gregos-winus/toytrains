// Procedural textures drawn on canvases (no image files to download).
// All textures tile seamlessly and are cached.

import * as THREE from 'three';

const cache = new Map();

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Tileable value noise (fBm) in [0, 1], `size` px, base period `cells`.
function noiseField(size, cells, octaves, seed) {
  const out = new Float32Array(size * size);
  const R = rng(seed);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = R();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const a = grid[(y0 % n) * n + (x0 % n)], b = grid[(y0 % n) * n + ((x0 + 1) % n)];
        const c = grid[((y0 + 1) % n) * n + (x0 % n)], d = grid[((y0 + 1) % n) * n + ((x0 + 1) % n)];
        out[y * size + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function hex(c) {
  const col = new THREE.Color(c);
  return [col.r * 255, col.g * 255, col.b * 255];
}

// Fill a canvas pixel by pixel from a noise field and a colour function.
function paintField(c, field, fn) {
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < field.length; i++) {
    const [r, g, b] = fn(field[i], i);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

// Normal map from a height field.
function normalFromField(field, size, strength) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => field[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const o = (y * size + x) * 4;
    img.data[o] = (-dx / l * 0.5 + 0.5) * 255;
    img.data[o + 1] = (dy / l * 0.5 + 0.5) * 255;
    img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false });
}

// ------------------------------------------------------------ ground
// Grey-scale detail map multiplied with the terrain vertex colours.
export function groundDetail() {
  return cached('ground', () => {
    const size = 512;
    const f1 = noiseField(size, 8, 5, 11);
    const f2 = noiseField(size, 64, 2, 12);
    const c = canvas(size);
    const ctx = paintField(c, f1, (v, i) => {
      const g = 170 + (v - 0.5) * 120 + (f2[i] - 0.5) * 70;
      return [g, g, g];
    });
    // grass blades and small stones
    const R = rng(13);
    for (let i = 0; i < 9000; i++) {
      const x = R() * size, y = R() * size, l = 2 + R() * 5, a = -Math.PI / 2 + (R() - 0.5) * 1.2;
      const v = 120 + R() * 130;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < 500; i++) {
      const v = 190 + R() * 60;
      ctx.fillStyle = `rgba(${v},${v},${v},0.7)`;
      ctx.beginPath(); ctx.arc(R() * size, R() * size, 0.6 + R() * 1.2, 0, 7); ctx.fill();
    }
    return toTexture(c, { srgb: false });
  });
}

export function groundNormal() {
  return cached('groundN', () => normalFromField(noiseField(256, 16, 4, 21), 256, 3));
}

// ------------------------------------------------------------ track
export function gravel() {
  return cached('gravel', () => {
    const size = 256;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6d665d';
    ctx.fillRect(0, 0, size, size);
    const R = rng(3);
    for (let i = 0; i < 2600; i++) {
      const x = R() * size, y = R() * size, r = 1.5 + R() * 3.2;
      const v = 70 + R() * 90;
      const tint = R() * 18;
      ctx.fillStyle = `rgb(${v + tint},${v + tint * 0.6},${v})`;
      const poly = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + R() * 0.5;
        const rr = r * (0.7 + R() * 0.5);
        poly.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        ctx.beginPath();
        poly.forEach(([px, py], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, x + ox + px, y + oy + py));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, 7); ctx.fill();
    }
    return toTexture(c);
  });
}

export function sleeperWood() {
  return cached('sleeper', () => {
    const c = canvas(128, 32);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4b3a2b';
    ctx.fillRect(0, 0, 128, 32);
    const R = rng(5);
    for (let i = 0; i < 40; i++) {
      const y = R() * 32, v = 40 + R() * 40;
      ctx.strokeStyle = `rgba(${v + 20},${v + 5},${v - 10},0.6)`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(40, y + R() * 4 - 2, 80, y + R() * 4 - 2, 128, y); ctx.stroke();
    }
    return toTexture(c);
  });
}

// ------------------------------------------------------------ materials
function planksCanvas(base, seed, vertical = true, board = 16) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const R = rng(seed);
  const [r, g, b] = hex(base);
  for (let x = 0; x < size; x += board) {
    const k = 0.8 + R() * 0.35;
    ctx.fillStyle = `rgb(${r * k},${g * k},${b * k})`;
    if (vertical) ctx.fillRect(x, 0, board, size); else ctx.fillRect(0, x, size, board);
    for (let i = 0; i < 10; i++) {
      const p = x + R() * board;
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`;
      ctx.beginPath();
      if (vertical) { ctx.moveTo(p, 0); ctx.lineTo(p + R() * 2 - 1, size); } else { ctx.moveTo(0, p); ctx.lineTo(size, p + R() * 2 - 1); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    if (vertical) ctx.fillRect(x, 0, 1.5, size); else ctx.fillRect(0, x, size, 1.5);
  }
  return c;
}

export function planks(base = '#7a5634', seed = 7) {
  return cached(`planks${base}`, () => toTexture(planksCanvas(base, seed)));
}

export function parquet() {
  return cached('parquet', () => toTexture(planksCanvas('#9a7148', 9, false, 32)));
}

export function brick(base = '#9b4a32') {
  return cached(`brick${base}`, () => {
    const size = 256;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b9ae9c';
    ctx.fillRect(0, 0, size, size);
    const R = rng(17);
    const [r, g, b] = hex(base);
    const bw = 32, bh = 16;
    for (let row = 0; row < size / bh; row++) {
      const off = (row % 2) * bw / 2;
      for (let x = -bw; x < size + bw; x += bw) {
        const k = 0.78 + R() * 0.35;
        ctx.fillStyle = `rgb(${r * k},${g * k},${b * k})`;
        ctx.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
      }
    }
    return toTexture(c);
  });
}

export function stone(base = '#8f8a80') {
  return cached(`stone${base}`, () => {
    const size = 256;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4c4944';
    ctx.fillRect(0, 0, size, size);
    const R = rng(23);
    const [r, g, b] = hex(base);
    const rows = 8, h = size / rows;
    for (let row = 0; row < rows; row++) {
      let x = -R() * 40;
      while (x < size) {
        const w = 28 + R() * 34;
        const k = 0.75 + R() * 0.4;
        ctx.fillStyle = `rgb(${r * k},${g * k},${b * k})`;
        const x0 = x + 1.5, y0 = row * h + 1.5;
        ctx.fillRect(x0, y0, w - 3, h - 3);
        if (x0 + w > size) ctx.fillRect(x0 - size, y0, w - 3, h - 3);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x0, y0, w - 3, 3);
        x += w;
      }
    }
    return toTexture(c);
  });
}

export function roofTiles(base = '#9b3f2f') {
  return cached(`tiles${base}`, () => {
    const size = 256;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const R = rng(29);
    const [r, g, b] = hex(base);
    ctx.fillStyle = `rgb(${r * 0.5},${g * 0.5},${b * 0.5})`;
    ctx.fillRect(0, 0, size, size);
    const tw = 16, th = 16;
    for (let row = 0; row < size / th; row++) {
      const off = (row % 2) * tw / 2;
      for (let x = -tw; x < size + tw; x += tw) {
        const k = 0.75 + R() * 0.35;
        const grad = ctx.createLinearGradient(0, row * th, 0, row * th + th);
        grad.addColorStop(0, `rgb(${r * k * 0.8},${g * k * 0.8},${b * k * 0.8})`);
        grad.addColorStop(1, `rgb(${r * k * 1.1},${g * k * 1.1},${b * k * 1.1})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x + off + 1, row * th);
        ctx.lineTo(x + off + tw - 1, row * th);
        ctx.lineTo(x + off + tw - 1, row * th + th - 3);
        ctx.quadraticCurveTo(x + off + tw / 2, row * th + th + 2, x + off + 1, row * th + th - 3);
        ctx.fill();
      }
    }
    return toTexture(c);
  });
}

export function asphalt() {
  return cached('asphalt', () => {
    const size = 256;
    const c = canvas(size);
    const f = noiseField(size, 32, 3, 31);
    const R = rng(32);
    paintField(c, f, (v) => { const g = 70 + v * 40 + R() * 14; return [g, g, g * 1.02]; });
    return toTexture(c);
  });
}

export function concrete() {
  return cached('concrete', () => {
    const size = 256;
    const c = canvas(size);
    const f = noiseField(size, 8, 5, 37);
    const ctx = paintField(c, f, (v) => { const g = 150 + v * 50; return [g, g * 0.98, g * 0.94]; });
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x <= size; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
    return toTexture(c);
  });
}

export function rockTex() {
  return cached('rock', () => {
    const size = 256;
    const c = canvas(size);
    const f = noiseField(size, 6, 6, 41);
    const f2 = noiseField(size, 24, 2, 42);
    paintField(c, f, (v, i) => { const g = 90 + v * 110 - f2[i] * 30; return [g, g * 0.97, g * 0.92]; });
    return toTexture(c);
  });
}

export function leaves(base = '#3f7d34', seed = 43) {
  return cached(`leaves${base}${seed}`, () => {
    const size = 128;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const [r, g, b] = hex(base);
    ctx.fillStyle = `rgb(${r * 0.6},${g * 0.6},${b * 0.6})`;
    ctx.fillRect(0, 0, size, size);
    const R = rng(seed);
    for (let i = 0; i < 1400; i++) {
      const k = 0.6 + R() * 0.7;
      ctx.fillStyle = `rgb(${Math.min(255, r * k)},${Math.min(255, g * k)},${Math.min(255, b * k)})`;
      ctx.beginPath(); ctx.ellipse(R() * size, R() * size, 1.5 + R() * 2.5, 1 + R() * 1.5, R() * 3, 0, 7); ctx.fill();
    }
    return toTexture(c);
  });
}

export function bark() {
  return cached('bark', () => toTexture(planksCanvas('#5b4230', 47, true, 6)));
}

export function waterNormal() {
  return cached('waterN', () => normalFromField(noiseField(256, 8, 5, 53), 256, 6));
}

export function coal() {
  return cached('coal', () => {
    const size = 128;
    const c = canvas(size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#151515';
    ctx.fillRect(0, 0, size, size);
    const R = rng(59);
    for (let i = 0; i < 700; i++) {
      const v = 20 + R() * 45;
      ctx.fillStyle = `rgb(${v},${v},${v + 3})`;
      ctx.beginPath(); ctx.arc(R() * size, R() * size, 1 + R() * 2.5, 0, 7); ctx.fill();
    }
    return toTexture(c);
  });
}

// Grass tuft sprite (alpha).
export function tuftTexture() {
  return cached('tuft', () => {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    const R = rng(61);
    for (let i = 0; i < 38; i++) {
      const x = 32 + (R() - 0.5) * 30, h = 26 + R() * 34;
      const v = 0.75 + R() * 0.5;
      ctx.strokeStyle = `rgb(${90 * v},${140 * v},${60 * v})`;
      ctx.lineWidth = 1.2 + R();
      ctx.beginPath(); ctx.moveTo(x, 64); ctx.quadraticCurveTo(x + (R() - 0.5) * 10, 64 - h / 2, x + (R() - 0.5) * 20, 64 - h); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#f2e35b', '#ffffff', '#d85a8f'][i % 3];
      ctx.beginPath(); ctx.arc(14 + R() * 36, 10 + R() * 28, 1.6, 0, 7); ctx.fill();
    }
    return toTexture(c, { repeat: false });
  });
}

export function smokeTexture() {
  return cached('smoke', () => {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(235,235,235,0.9)');
    g.addColorStop(0.5, 'rgba(200,200,200,0.45)');
    g.addColorStop(1, 'rgba(180,180,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return toTexture(c, { repeat: false });
  });
}

// Spoked wheel face.
export function wheelFace(color = '#b3202a', spokes = 14) {
  return cached(`wheel${color}${spokes}`, () => {
    const c = canvas(128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(64, 64, 64, 0, 7); ctx.fill();
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath(); ctx.arc(64, 64, 63, 0, 7); ctx.arc(64, 64, 56, 0, 7, true); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(64, 64, 55, 0, 7); ctx.arc(64, 64, 48, 0, 7, true); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(64 + Math.cos(a) * 12, 64 + Math.sin(a) * 12); ctx.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(64, 64, 15, 0, 7); ctx.fill();
    // counterweight
    ctx.beginPath(); ctx.arc(64, 64, 48, 2.3, 3.9); ctx.arc(64, 64, 22, 3.9, 2.3, true); ctx.fill();
    ctx.fillStyle = '#ccc';
    ctx.beginPath(); ctx.arc(64, 64, 5, 0, 7); ctx.fill();
    return toTexture(c, { repeat: false });
  });
}

export function discWheel() {
  return cached('discwheel', () => {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8f8f8f';
    ctx.beginPath(); ctx.arc(32, 32, 32, 0, 7); ctx.fill();
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath(); ctx.arc(32, 32, 27, 0, 7); ctx.fill();
    ctx.fillStyle = '#3c3c3c';
    ctx.beginPath(); ctx.arc(32, 32, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#aaa';
    ctx.beginPath(); ctx.arc(32, 32, 3, 0, 7); ctx.fill();
    return toTexture(c, { repeat: false });
  });
}

// Vertical louvres / grille panel.
export function grille(base) {
  return cached(`grille${base}`, () => {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let x = 3; x < 64; x += 6) ctx.fillRect(x, 4, 3, 56);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(1, 1, 62, 62);
    return toTexture(c);
  });
}

// ------------------------------------------------------------ facades
// One bay of a facade: wall material with a window. Used with UVs in mm so
// that windows repeat along any wall.
export function facade(style = 'plaster', wall = '#e8dfcf', opts = {}) {
  const key = `facade${style}${wall}${JSON.stringify(opts)}`;
  return cached(key, () => {
    const W = 128, H = 160;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const R = rng(71);
    const [r, g, b] = hex(wall);
    if (style === 'brick') {
      ctx.drawImage(brick(wall).image, 0, 0, W, H);
    } else {
      const f = noiseField(128, 8, 4, 73);
      const img = ctx.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = 0.9 + f[(y % 128) * 128 + x] * 0.16;
        const o = (y * W + x) * 4;
        img.data[o] = r * v; img.data[o + 1] = g * v; img.data[o + 2] = b * v; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    if (style === 'timber') {
      ctx.fillStyle = opts.timber || '#4a2c1c';
      ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
      ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8);
      ctx.fillRect(0, H * 0.72, W, 7);
      ctx.save();
      ctx.lineWidth = 7;
      ctx.strokeStyle = opts.timber || '#4a2c1c';
      ctx.beginPath(); ctx.moveTo(4, H * 0.72); ctx.lineTo(W * 0.25, H - 4); ctx.moveTo(W - 4, H * 0.72); ctx.lineTo(W * 0.75, H - 4); ctx.stroke();
      ctx.restore();
    }
    if (opts.window !== false) {
      const ww = opts.tall ? W * 0.34 : W * 0.4, wh = opts.tall ? H * 0.62 : H * 0.42;
      const wx = (W - ww) / 2, wy = opts.tall ? H * 0.12 : H * 0.22;
      // frame / sill / lintel
      ctx.fillStyle = opts.frame || '#f4f1ea';
      ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(wx - 8, wy + wh + 5, ww + 16, 5);
      const glass = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      glass.addColorStop(0, '#2c3e52');
      glass.addColorStop(0.5, '#4f6f8c');
      glass.addColorStop(1, '#1d2a38');
      ctx.fillStyle = glass;
      if (opts.tall) {
        ctx.beginPath();
        ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + ww / 2); ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.fill();
      } else ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = opts.frame || '#f4f1ea';
      ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      ctx.fillRect(wx, wy + wh * 0.45, ww, 4);
      if (opts.shutters) {
        ctx.fillStyle = opts.shutters;
        ctx.fillRect(wx - 5 - ww * 0.42, wy - 3, ww * 0.4, wh + 6);
        ctx.fillRect(wx + ww + 5 + ww * 0.02, wy - 3, ww * 0.4, wh + 6);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = wy; y < wy + wh; y += 6) {
          ctx.fillRect(wx - 5 - ww * 0.42, y, ww * 0.4, 2);
          ctx.fillRect(wx + ww + 5 + ww * 0.02, y, ww * 0.4, 2);
        }
      }
    }
    // weathering
    const grad = ctx.createLinearGradient(0, H * 0.8, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(40,30,20,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    void R;
    return toTexture(c);
  });
}

// Door decal.
export function doorTex(color = '#6b3f26', glass = false) {
  return cached(`door${color}${glass}`, () => {
    const c = canvas(64, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e2d4';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = color;
    ctx.fillRect(6, 8, 52, 120);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 16, 40, 44);
    ctx.strokeRect(12, 68, 40, 50);
    if (glass) { ctx.fillStyle = '#3d556e'; ctx.fillRect(14, 18, 36, 40); }
    ctx.fillStyle = '#d8c26a';
    ctx.beginPath(); ctx.arc(48, 70, 3, 0, 7); ctx.fill();
    return toTexture(c, { repeat: false });
  });
}

// Shop front with awning colours.
export function shopFront(color = '#2f5d3a', label = 'BÄCKEREI') {
  return cached(`shop${color}${label}`, () => {
    const c = canvas(256, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e9e1cf';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 128, 20);
    const glass = ctx.createLinearGradient(0, 32, 0, 128);
    glass.addColorStop(0, '#6f8ba3');
    glass.addColorStop(1, '#233140');
    ctx.fillStyle = glass;
    ctx.fillRect(12, 34, 90, 80);
    ctx.fillRect(154, 34, 90, 80);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(110, 38, 36, 90);
    ctx.fillStyle = '#e8d9a8';
    for (let i = 0; i < 6; i++) ctx.fillRect(18 + i * 14, 96, 10, 10);
    return toTexture(c, { repeat: false });
  });
}

// Sign board with text.
export function signTex(text, bg = '#1d3f73', fg = '#ffffff', w = 256, h = 48) {
  return cached(`sign${text}${bg}${fg}${w}${h}`, () => {
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = fg;
    ctx.font = `bold ${Math.floor(h * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 1);
    return toTexture(c, { repeat: false });
  });
}

export function clockTex() {
  return cached('clock', () => {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f6f3ea';
    ctx.beginPath(); ctx.arc(32, 32, 31, 0, 7); ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(32, 32, 29, 0, 7); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); ctx.lineTo(32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27); ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32, 14); ctx.moveTo(32, 32); ctx.lineTo(44, 38); ctx.stroke();
    return toTexture(c, { repeat: false });
  });
}

// ------------------------------------------------------------ liveries
// Side view of a vehicle body, drawn at 4 px/mm. `kind` selects the layout.
export function liverySide(st, bodyLen, bodyH) {
  const key = `livery${st.ref}${bodyLen}${bodyH}`;
  return cached(key, () => {
    const S = 4;
    const W = Math.round(bodyLen * S), H = Math.round(bodyH * S);
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const col = st.color, col2 = st.color2 || st.color;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    const glass = (x, y, w, h, r = 3) => {
      const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
      g.addColorStop(0, '#5f7f9c');
      g.addColorStop(0.45, '#2a3b4d');
      g.addColorStop(1, '#16202b');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.strokeStyle = 'rgba(210,210,210,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    const text = (s, x, y, size, color = '#f2efe6', align = 'left') => {
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px sans-serif`;
      ctx.textAlign = align;
      ctx.fillText(s, x, y);
    };
    const dbLogo = (x, y, s) => {
      ctx.strokeStyle = '#f2efe6';
      ctx.lineWidth = s * 0.12;
      ctx.strokeRect(x, y, s * 1.4, s);
      text('DB', x + s * 0.7, y + s * 0.78, s * 0.75, '#f2efe6', 'center');
    };
    const door = (x, w) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, H * 0.1, w, H * 0.86);
      glass(x + w * 0.2, H * 0.18, w * 0.6, H * 0.3, 2);
    };
    switch (st.style) {
      case 'coach': {
        const band = col2 !== col;
        if (band) { ctx.fillStyle = col2; ctx.fillRect(0, H * 0.14, W, H * 0.42); }
        if (st.ref === '5125') { // Silberling / City-Bahn: orange with grey band
          ctx.fillStyle = '#9a9a96'; ctx.fillRect(0, H * 0.16, W, H * 0.38);
        }
        const doorW = 11 * S;
        door(W * 0.02, doorW);
        door(W * 0.98 - doorW, doorW);
        const n = Math.round((bodyLen - 40) / 16);
        const span = W - 2 * (W * 0.02 + doorW) - 20;
        for (let i = 0; i < n; i++) {
          const x = W * 0.02 + doorW + 10 + (span / n) * i + 4;
          glass(x, H * 0.2, span / n - 8, H * 0.3);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, H * 0.93, W, H * 0.07);
        if (st.ref === '5161') { text('TEE', W * 0.5, H * 0.72, H * 0.14, '#e8dcb5', 'center'); text('1', W * 0.12, H * 0.72, H * 0.16, '#ffd84a', 'center'); }
        if (st.ref === '5160') { text('ÖBB', W * 0.5, H * 0.74, H * 0.12, '#e9e3d0', 'center'); }
        if (st.ref === '5125') { dbLogo(W * 0.46, H * 0.62, H * 0.16); }
        text(`${st.rw} ${st.ref}`, W * 0.9, H * 0.9, H * 0.07, '#e9e3d0', 'right');
        break;
      }
      case 'electric': {
        ctx.fillStyle = col2;
        ctx.fillRect(0, H * 0.58, W, H * 0.16);
        glass(W * 0.015, H * 0.1, W * 0.07, H * 0.32);
        glass(W * 0.915, H * 0.1, W * 0.07, H * 0.32);
        for (let i = 0; i < 6; i++) {
          ctx.drawImage(grille(col).image, W * 0.16 + i * W * 0.115, H * 0.12, W * 0.1, H * 0.34);
        }
        dbLogo(W * 0.46, H * 0.62, H * 0.13);
        text('103 118-6', W * 0.2, H * 0.9, H * 0.08);
        break;
      }
      case 'diesel-hood': {
        ctx.fillStyle = '#d9d4c7';
        ctx.fillRect(0, H * 0.84, W, H * 0.16);
        for (let i = 0; i < 4; i++) ctx.drawImage(grille(col).image, W * (0.05 + i * 0.075), H * 0.2, W * 0.06, H * 0.5);
        for (let i = 0; i < 4; i++) ctx.drawImage(grille(col).image, W * (0.66 + i * 0.075), H * 0.2, W * 0.06, H * 0.5);
        dbLogo(W * 0.46, H * 0.55, H * 0.12);
        text('218 217-8', W * 0.5, H * 0.95, H * 0.07, '#333', 'center');
        break;
      }
      default:
        break;
    }
    // panel lines and dirt
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    const grad = ctx.createLinearGradient(0, H * 0.75, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(40,30,20,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    return toTexture(c, { repeat: false });
  });
}

// Cab side with windows for steam/diesel cabs.
export function cabSide(color) {
  return cached(`cab${color}`, () => {
    const c = canvas(96, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 96, 128);
    const g = ctx.createLinearGradient(0, 0, 60, 60);
    g.addColorStop(0, '#5f7f9c'); g.addColorStop(1, '#16202b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(14, 14, 30, 36, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(52, 14, 30, 36, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(1, 1, 94, 126);
    return toTexture(c, { repeat: false });
  });
}

export function numberPlate(text, bg = '#111', fg = '#f0e6c8') {
  return signTex(text, bg, fg, 160, 40);
}
