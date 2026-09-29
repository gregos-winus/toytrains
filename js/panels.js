// Side panels: catalogues (left) and properties / cab / layout (right).

import { TRACK_TYPES, TRACK_GROUPS, pieceGeometry, isSwitchable, trackType } from './catalog/tracks.js';
import { SCENERY_TYPES, SCENERY_GROUPS, sceneryType } from './catalog/scenery.js';
import { ROLLING_STOCK, PRESET_TRAINS, stock } from './catalog/rolling-stock.js';
import {
  PAINTS, billOfMaterials, totalTrackLength, openEndpoints, resizeBoard, buildEmbankments,
  setEndpointHeight, worldEndpoints, routePose,
} from './model.js';
import { chainAdd, deleteSelection, rotateSelection, stateName } from './editor.js';
import { reverseTrain, mmsToKmh, trainLength, trainVmax } from './sim.js';
import { t, tr } from './i18n.js';
import { DEG, normAngle } from './geom.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Small SVG drawing of a track piece.
export function trackIcon(ref) {
  const g = pieceGeometry({ ref, len: trackType(ref)?.variable?.def });
  const polys = g.routes.map((r) => {
    const pts = [];
    const n = Math.max(4, Math.ceil(r.len / 10));
    for (let i = 0; i <= n; i++) pts.push(routePose({ x: 0, y: 0, rot: 0, h: [] }, g, r, (r.len * i) / n));
    return pts;
  });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys.flat()) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const W = 64, H = 40, pad = 6;
  const s = Math.min((W - 2 * pad) / Math.max(1, x1 - x0), (H - 2 * pad) / Math.max(1, y1 - y0), 0.3);
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'icon');
  for (const [width, color] of [[38 * s + 2, '#8a8174'], [2, '#e8e8e8']]) {
    for (const pts of polys) {
      const path = document.createElementNS(ns, 'polyline');
      path.setAttribute('points', pts.map((p) => `${(ox + (p.x - x0) * s).toFixed(1)},${(H - oy - (p.y - y0) * s).toFixed(1)}`).join(' '));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', Math.max(1.5, width));
      svg.append(path);
    }
  }
  if (g.kind === 'buffer') {
    const last = polys[0][polys[0].length - 1];
    const c = document.createElementNS(ns, 'rect');
    c.setAttribute('x', ox + (last.x - x0) * s - 2);
    c.setAttribute('y', H / 2 - 7);
    c.setAttribute('width', 4); c.setAttribute('height', 14); c.setAttribute('fill', '#c0392b');
    svg.append(c);
  }
  return svg;
}

function fmtLen(mm) {
  return mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`;
}

function numInput(value, onChange, attrs = {}) {
  return h('input', {
    type: 'number', value: String(Math.round(value * 10) / 10), step: attrs.step || 1, class: 'num', ...attrs,
    onchange: (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v); },
  });
}

// ===========================================================================
export class Panels {
  constructor(app) {
    this.app = app;
    this.left = document.getElementById('left-panel');
    this.right = document.getElementById('right-panel');
    this.tab = 'tracks';
    app.on('tool', () => this.renderLeft());
    app.on('selection', () => this.renderProps());
    app.on('layout', () => { this.renderProps(); this.renderLayoutInfo(); });
    app.on('switch', () => this.renderProps());
    app.on('trains', () => { this.renderCab(); if (this.tab === 'trains') this.renderLeft(); });
    app.on('lang', () => this.renderAll());
    document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      const toolFor = { tracks: 'select', terrain: 'terrain', scenery: 'select', trains: 'select' };
      if (this.tab === 'terrain') app.setTool('terrain');
      else if (app.tool === 'terrain') app.setTool(toolFor[this.tab]);
      this.renderLeft();
    }));
    this.renderAll();
  }

  renderAll() {
    this.renderLeft();
    this.right.innerHTML = '';
    this.cabEl = h('section', { class: 'card', id: 'cab' });
    this.propsEl = h('section', { class: 'card', id: 'props' });
    this.layoutEl = h('section', { class: 'card', id: 'layout-info' });
    this.right.append(this.cabEl, this.propsEl, this.layoutEl);
    this.renderCab();
    this.renderProps();
    this.renderLayoutInfo();
  }

  // ------------------------------------------------------------------- left
  renderLeft() {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    const el = this.left;
    const scroll = el.scrollTop;
    el.innerHTML = '';
    if (this.tab === 'tracks') this.renderTracksTab(el);
    else if (this.tab === 'terrain') this.renderTerrainTab(el);
    else if (this.tab === 'scenery') this.renderSceneryTab(el);
    else this.renderTrainsTab(el);
    el.scrollTop = scroll;
  }

  toolRow() {
    const app = this.app;
    return h('div', { class: 'toolrow' },
      h('button', { class: app.tool === 'select' ? 'active' : '', onclick: () => app.setTool('select') }, '⬚ ', t('toolSelect')),
      h('button', { class: app.tool === 'operate' ? 'active' : '', onclick: () => app.setTool('operate') }, '⑂ ', t('toolOperate')),
    );
  }

  hint(key) {
    return h('p', { class: 'hint' }, t(key));
  }

  renderTracksTab(el) {
    const app = this.app;
    el.append(this.toolRow());
    const hintKey = app.anchor ? 'hintChain' : app.tool === 'track' ? 'hintTrack' : app.tool === 'operate' ? 'hintOperate' : 'hintSelect';
    el.append(this.hint(hintKey));
    el.append(h('h3', { class: 'brand' }, t('catalogueTracks')));
    for (const grp of TRACK_GROUPS) {
      el.append(h('h4', {}, tr(grp.name)));
      const grid = h('div', { class: 'catalog' });
      for (const tt of TRACK_TYPES.filter((x) => grp.kinds.includes(x.kind))) {
        const active = app.tool === 'track' && app.trackRef === tt.ref;
        grid.append(h('button', {
          class: `item ${active ? 'active' : ''}`,
          title: `${tt.ref} — ${tr(tt.name)}`,
          onclick: () => {
            if (app.anchor) chainAdd(app, tt.ref);
            else app.setTool('track', { trackRef: tt.ref });
          },
        }, trackIcon(tt.ref), h('span', { class: 'ref' }, tt.ref), h('span', { class: 'nm' }, tr(tt.name))));
      }
      el.append(grid);
    }
  }

  renderTerrainTab(el) {
    const app = this.app;
    const b = app.brush;
    el.append(this.hint('hintTerrain'));
    el.append(h('h4', {}, t('brush')));
    const modes = ['raise', 'lower', 'smooth', 'flatten', 'paint'];
    el.append(h('div', { class: 'seg' }, modes.map((m) => h('button', {
      class: b.mode === m ? 'active' : '', onclick: () => { b.mode = m; this.renderLeft(); },
    }, t(m)))));
    const slider = (label, key, min, max, step) => h('label', { class: 'slider' },
      h('span', {}, label), h('input', {
        type: 'range', min, max, step, value: b[key],
        oninput: (e) => { b[key] = +e.target.value; e.target.nextSibling.textContent = e.target.value; app.emit('tool'); },
      }), h('output', {}, b[key]));
    el.append(slider(t('radius'), 'radius', 20, 400, 5));
    if (b.mode !== 'paint') el.append(slider(t('strength'), 'strength', 1, 15, 1));
    if (b.mode === 'paint') {
      el.append(h('h4', {}, t('paintColor')));
      el.append(h('div', { class: 'swatches' }, PAINTS.map((p, i) => h('button', {
        class: b.paint === i ? 'active' : '', title: t(p.id),
        style: `background: rgb(${p.color.join(',')})`,
        onclick: () => { b.paint = i; this.renderLeft(); },
      }, t(p.id)))));
    }
    el.append(h('p', { class: 'hint' }, t('terrainNote')));
    el.append(h('div', { class: 'stack' },
      h('button', {
        onclick: () => { buildEmbankments(app.layout); app.commit({ terrain: true }); },
      }, t('embankments')),
      h('button', {
        class: 'danger',
        onclick: () => { app.layout.terrain.heights.fill(0); app.commit({ terrain: true }); },
      }, t('resetTerrain')),
    ));
  }

  renderSceneryTab(el) {
    const app = this.app;
    el.append(this.toolRow());
    el.append(this.hint(app.tool === 'scenery' ? 'hintScenery' : 'hintSelect'));
    for (const grp of SCENERY_GROUPS) {
      el.append(h('h4', {}, tr(grp.name)));
      const grid = h('div', { class: 'catalog' });
      for (const st of SCENERY_TYPES.filter((s) => s.group === grp.id)) {
        const active = app.tool === 'scenery' && app.sceneryId === st.id;
        grid.append(h('button', {
          class: `item ${active ? 'active' : ''}`,
          title: tr(st.name),
          onclick: () => app.setTool('scenery', { sceneryId: st.id }),
        },
        h('span', { class: `swatch ${st.shape === 'circle' ? 'round' : ''}`, style: `background:${st.color}; border-color:${st.roof || st.color}` }),
        h('span', { class: 'nm' }, tr(st.name)),
        h('span', { class: 'dim' }, `${st.w}×${st.d}×${st.h}`)));
      }
      el.append(grid);
    }
  }

  renderTrainsTab(el) {
    const app = this.app;
    el.append(h('h4', {}, t('consist')));
    const chips = h('div', { class: 'consist' });
    if (!app.consist.length) chips.append(h('p', { class: 'hint' }, t('emptyConsist')));
    app.consist.forEach((ref, i) => {
      const st = stock(ref);
      chips.append(h('button', {
        class: 'chip', title: `${t('remove')} — ${tr(st.name)}`, style: `border-left: 6px solid ${st.color}`,
        onclick: () => { app.consist.splice(i, 1); this.renderLeft(); },
      }, `${ref} ✕`));
    });
    el.append(chips);
    const hasLoco = app.consist.some((r) => stock(r)?.kind === 'loco');
    const len = app.consist.reduce((s, r) => s + (stock(r)?.length || 0), 0);
    if (app.consist.length) el.append(h('p', { class: 'hint' }, `${t('length')}: ${fmtLen(len)}`));
    if (app.consist.length && !hasLoco) el.append(h('p', { class: 'warn' }, t('needLoco')));
    el.append(h('div', { class: 'stack row' },
      h('button', {
        class: `primary ${app.tool === 'train' ? 'active' : ''}`, disabled: !hasLoco,
        onclick: () => app.setTool('train'),
      }, '▶ ', t('placeTrain')),
      h('button', { onclick: () => { app.consist = []; this.renderLeft(); } }, t('clearConsist')),
    ));
    if (app.tool === 'train') el.append(this.hint('hintTrainPlace'));

    el.append(h('h4', {}, t('presets')));
    el.append(h('div', { class: 'stack' }, PRESET_TRAINS.map((p) => h('button', {
      class: 'preset',
      onclick: () => { app.consist = [...p.consist]; app.setTool('train'); this.renderLeft(); },
    }, tr(p.name), h('span', { class: 'dim' }, p.consist.join(' + '))))));

    for (const [kind, label] of [['loco', 'locomotives'], ['coach', 'coaches'], ['wagon', 'wagons']]) {
      el.append(h('h4', {}, t(label)));
      const list = h('div', { class: 'stocklist' });
      for (const st of ROLLING_STOCK.filter((s) => s.kind === kind)) {
        list.append(h('button', {
          class: 'stock', onclick: () => { app.consist.push(st.ref); this.renderLeft(); },
        },
        h('span', { class: 'bar', style: `background: linear-gradient(90deg, ${st.color} 70%, ${st.color2 || st.color} 70%)` }),
        h('span', { class: 'ref' }, `Fleischmann ${st.ref}`),
        h('span', { class: 'nm' }, tr(st.name)),
        h('span', { class: 'dim' }, `${st.rw} · ${t('length')} ${st.length} mm${st.vmax ? ` · ${st.vmax} km/h` : ''}`)));
      }
      el.append(list);
    }
  }

  // ------------------------------------------------------------------ right
  renderCab() {
    const app = this.app;
    const el = this.cabEl;
    if (!el) return;
    el.innerHTML = '';
    el.append(h('h3', {}, t('cab'),
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'small', onclick: () => { app.running = !app.running; this.renderCab(); },
      }, app.running ? `⏸ ${t('pause')}` : `▶ ${t('play')}`),
      h('button', {
        class: 'small danger', onclick: () => {
          for (const tr0 of app.layout.trains) { tr0.throttle = 0; tr0.speed = 0; }
          this.renderCab();
        },
      }, `■ ${t('allStop')}`)));
    const L = app.layout;
    if (!L.trains.length) {
      el.append(h('p', { class: 'hint' }, t('noTrains')));
      return;
    }
    this.speedEls = new Map();
    for (const train of L.trains) {
      const active = train.id === app.activeTrain;
      const speedEl = h('span', { class: 'speed' }, '0');
      this.speedEls.set(train.id, speedEl);
      const vmax = trainVmax(train);
      const card = h('div', { class: `train ${active ? 'active' : ''}`, onclick: () => { app.activeTrain = train.id; this.renderCab(); app.emit('active-train'); } },
        h('div', { class: 'row' },
          h('input', {
            class: 'name', value: train.name,
            onchange: (e) => { train.name = e.target.value; app.scheduleSave(); },
          }),
          speedEl, h('span', { class: 'unit' }, t('kmh'))),
        h('input', {
          type: 'range', min: 0, max: 100, step: 1, value: Math.round((train.throttle || 0) * 100), class: 'throttle',
          title: `${t('throttle')} (max ${vmax} km/h)`,
          oninput: (e) => { train.throttle = +e.target.value / 100; },
        }),
        h('div', { class: 'row buttons' },
          h('button', {
            class: 'small', title: t('reverse'),
            onclick: (e) => {
              e.stopPropagation();
              if (train.speed > 1) { train.throttle = 0; return; }
              reverseTrain(L, train); app.scheduleSave(); this.renderCab();
            },
          }, `⇄ ${t('reverse')}`),
          h('button', {
            class: 'small', onclick: (e) => { e.stopPropagation(); train.throttle = 0; this.renderCab(); },
          }, `■ ${t('stop')}`),
          h('label', { class: 'check', title: t('shuttle') },
            h('input', { type: 'checkbox', checked: !!train.shuttle, onchange: (e) => { train.shuttle = e.target.checked; app.scheduleSave(); } }),
            '↔'),
          h('span', { class: 'spacer' }),
          h('button', {
            class: 'small danger', title: t('remove'),
            onclick: (e) => {
              e.stopPropagation();
              L.trains = L.trains.filter((x) => x !== train);
              app.emit('trains'); app.scheduleSave();
            },
          }, '✕')),
        h('div', { class: 'dim' }, `${train.consist.join(' + ')} · ${fmtLen(trainLength(train))}`));
      el.append(card);
    }
  }

  // called every frame: update speed readouts only
  tick() {
    if (!this.speedEls) return;
    for (const train of this.app.layout.trains) {
      const el = this.speedEls.get(train.id);
      if (el) {
        const v = Math.round(mmsToKmh(train.speed || 0));
        if (el.textContent !== String(v)) el.textContent = v;
      }
    }
  }

  renderProps() {
    const app = this.app;
    const el = this.propsEl;
    if (!el) return;
    el.innerHTML = '';
    el.append(h('h3', {}, t('properties')));
    const pieces = app.selectedPieces();
    const scen = app.selectedScenery();
    const n = pieces.length + scen.length;
    if (!n) {
      el.append(h('p', { class: 'hint' }, t('nothingSelected')));
      return;
    }
    if (n > 1) {
      el.append(h('p', {}, t('selectionCount', { n })));
      el.append(h('div', { class: 'stack row' },
        h('button', { onclick: () => rotateSelection(app, 9 * DEG) }, t('rotateL')),
        h('button', { onclick: () => rotateSelection(app, -9 * DEG) }, t('rotateR')),
      ));
      if (pieces.length) {
        el.append(h('div', { class: 'stack row' },
          h('button', { onclick: () => { for (const p of pieces) p.h = p.h.map((z) => z + 5); app.commit(); } }, t('raiseSel')),
          h('button', { onclick: () => { for (const p of pieces) p.h = p.h.map((z) => z - 5); app.commit(); } }, t('lowerSel')),
        ));
      }
      el.append(h('button', { class: 'danger', onclick: () => deleteSelection(app) }, `🗑 ${t('delete')}`));
      return;
    }
    if (pieces.length) {
      const p = pieces[0];
      const g = pieceGeometry(p);
      el.append(h('div', { class: 'prop-title' }, h('b', {}, `Fleischmann ${p.ref}`), h('span', {}, tr(g.name))));
      if (g.variable) {
        el.append(h('label', { class: 'field' }, h('span', {}, `${t('length')} (${g.variable.min}–${g.variable.max})`),
          numInput(p.len || g.variable.def, (v) => {
            p.len = Math.min(g.variable.max, Math.max(g.variable.min, v));
            app.commit();
          })));
      }
      if (isSwitchable(g)) {
        el.append(h('label', { class: 'field' }, h('span', {}, t('state')),
          h('div', { class: 'seg' }, g.states.map((_, i) => h('button', {
            class: (p.state || 0) === i ? 'active' : '',
            onclick: () => { p.state = i; app.emit('switch', p); app.scheduleSave(); },
          }, stateName(g, i))))));
      }
      el.append(h('label', { class: 'field' }, h('span', {}, t('rotation')),
        numInput(normAngle(p.rot) / DEG, (v) => { p.rot = normAngle(v * DEG); app.commit(); }, { step: 9 })));
      el.append(h('div', { class: 'field' }, h('span', {}, t('position')),
        h('span', {}, 'x ', numInput(p.x, (v) => { p.x = v; app.commit(); }), ' y ', numInput(p.y, (v) => { p.y = v; app.commit(); }))));
      el.append(h('h4', {}, t('heights')));
      const eps = worldEndpoints(p);
      eps.forEach((e, i) => {
        el.append(h('label', { class: 'field' }, h('span', {}, `${t('end')} ${i}${e.buffer ? ' ⊣' : ''}`),
          numInput(p.h[i], (v) => { setEndpointHeight(app.layout, p, i, v); app.commit(); })));
      });
      // gradient info
      const r0 = g.routes[0];
      const grade = ((p.h[r0.to] - p.h[r0.from]) / r0.len) * 100;
      el.append(h('p', { class: 'dim' }, `${t('gradient')}: ${grade.toFixed(1)} % · ${t('length')}: ${r0.len.toFixed(1)} mm`));
      if (g.endpoints.length === 2) {
        const gradeIn = h('input', { type: 'number', value: '2', step: '0.5', class: 'num' });
        el.append(h('div', { class: 'field' }, h('span', { title: t('rampHint') }, `${t('makeRamp')} %`), gradeIn,
          h('button', {
            class: 'small', onclick: () => {
              const pc = parseFloat(gradeIn.value) || 0;
              setEndpointHeight(app.layout, p, r0.to, p.h[r0.from] + (pc / 100) * r0.len);
              app.commit();
            },
          }, '↗')));
      }
      el.append(h('div', { class: 'stack row' },
        h('button', { onclick: () => rotateSelection(app, 9 * DEG) }, t('rotateL')),
        h('button', { onclick: () => rotateSelection(app, -9 * DEG) }, t('rotateR')),
        h('button', { class: 'danger', onclick: () => deleteSelection(app) }, `🗑 ${t('delete')}`)));
      return;
    }
    const s = scen[0];
    const st = sceneryType(s.kind);
    el.append(h('div', { class: 'prop-title' }, h('b', {}, tr(st.name)), h('span', {}, `${st.w}×${st.d}×${st.h} mm`)));
    el.append(h('label', { class: 'field' }, h('span', {}, t('rotation')),
      numInput(normAngle(s.rot || 0) / DEG, (v) => { s.rot = normAngle(v * DEG); app.commit(); }, { step: 15 })));
    el.append(h('label', { class: 'field' }, h('span', {}, t('scale')),
      numInput(s.scale || 1, (v) => { s.scale = Math.min(4, Math.max(0.2, v)); app.commit(); }, { step: 0.1 })));
    el.append(h('div', { class: 'field' }, h('span', {}, t('position')),
      h('span', {}, 'x ', numInput(s.x, (v) => { s.x = v; app.commit(); }), ' y ', numInput(s.y, (v) => { s.y = v; app.commit(); }))));
    el.append(h('label', { class: 'field' }, h('span', {}, t('heightAuto')),
      h('input', {
        type: 'number', class: 'num', value: s.z ?? '', placeholder: 'auto',
        onchange: (e) => { const v = parseFloat(e.target.value); s.z = Number.isNaN(v) ? undefined : v; app.commit(); },
      })));
    el.append(h('div', { class: 'stack row' },
      h('button', { onclick: () => rotateSelection(app, 15 * DEG) }, t('rotateL')),
      h('button', { onclick: () => rotateSelection(app, -15 * DEG) }, t('rotateR')),
      h('button', { class: 'danger', onclick: () => deleteSelection(app) }, `🗑 ${t('delete')}`)));
  }

  renderLayoutInfo() {
    const app = this.app;
    const el = this.layoutEl;
    if (!el) return;
    const L = app.layout;
    el.innerHTML = '';
    el.append(h('h3', {}, t('layout')));
    el.append(h('label', { class: 'field' }, h('span', {}, t('layoutName')),
      h('input', { value: L.name || '', onchange: (e) => { L.name = e.target.value; app.commit(); } })));
    const wIn = numInput(L.board.w, () => {}, { step: 100, min: 500, max: 12000 });
    const dIn = numInput(L.board.d, () => {}, { step: 100, min: 300, max: 8000 });
    el.append(h('div', { class: 'field' }, h('span', {}, t('boardSize')),
      h('span', {}, wIn, ' × ', dIn, ' ', h('button', {
        class: 'small', onclick: () => {
          const w = Math.min(12000, Math.max(500, +wIn.value || L.board.w));
          const d = Math.min(8000, Math.max(300, +dIn.value || L.board.d));
          resizeBoard(L, w, d);
          app.commit({ terrain: true });
          app.emit('board');
        },
      }, t('apply')))));
    const opens = openEndpoints(L).length;
    el.append(h('h4', {}, t('stats')));
    el.append(h('table', { class: 'stats' },
      h('tr', {}, h('td', {}, t('pieces')), h('td', {}, L.pieces.length)),
      h('tr', {}, h('td', {}, t('trackLength')), h('td', {}, fmtLen(totalTrackLength(L)))),
      h('tr', {}, h('td', {}, t('openEnds')), h('td', { class: opens ? 'warn' : '' }, opens)),
    ));
    const bom = billOfMaterials(L);
    el.append(h('h4', {}, t('bom')));
    if (bom.length) {
      el.append(h('table', { class: 'bom' },
        h('tr', {}, h('th', {}, t('ref')), h('th', {}, t('description')), h('th', {}, t('qty'))),
        bom.map((b) => h('tr', {}, h('td', {}, b.ref), h('td', {}, tr(trackType(b.ref)?.name)), h('td', { class: 'n' }, b.count)))));
    }
  }
}
