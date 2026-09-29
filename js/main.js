// Entry point: wires the application state, views, panels and top bar.

import { App } from './app.js';
import { PlanView } from './plan2d.js';
import { Panels } from './panels.js';
import { initLang, setLang, getLang, applyI18n, t, tr } from './i18n.js';
import { createLayout, serialize, deserialize, billOfMaterials, findPiece } from './model.js';
import { trackType } from './catalog/tracks.js';
import { stepTrains } from './sim.js';
import { LAYOUTS, layoutById } from './layouts/index.js';
import { deleteSelection, rotateSelection, flipLast, removeLast } from './editor.js';
import { DEG } from './geom.js';

initLang();
const app = new App();
window.hoApp = app; // handy for debugging from the console

const plan = new PlanView(app, document.getElementById('plan'));
let view3d = null;
const panels = new Panels(app);

// 3D view is loaded lazily so the plan editor works even without WebGL.
import('./view3d.js').then(({ View3D }) => {
  try {
    view3d = new View3D(app, document.getElementById('three-wrap'));
    window.hoView3d = view3d;
    updateViewMode();
  } catch (err) {
    console.error(err);
    document.getElementById('three-wrap').append(Object.assign(document.createElement('p'), {
      className: 'hint', textContent: 'WebGL is not available: the 3D view is disabled.',
    }));
  }
});

// ------------------------------------------------------------ initial layout
const saved = app.loadLocal();
if (saved) app.setLayout(saved);
else {
  const def0 = layoutById('mainline');
  const L0 = def0.build();
  L0.name = tr(def0.name);
  app.setLayout(L0);
}

// ------------------------------------------------------------------ top bar
const $ = (id) => document.getElementById(id);

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function fileBase() {
  return (app.layout.name || 'layout').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'layout';
}

$('btn-new').onclick = () => {
  if (!confirm(t('confirmNew'))) return;
  const b = app.layout.board;
  app.setLayout(createLayout({ width: b.w, depth: b.d }));
  plan.fit();
  view3d?.resetCamera();
};
function renderLayoutList() {
  const list = $('layouts-list');
  list.innerHTML = '';
  for (const def of LAYOUTS) {
    const card = document.createElement('button');
    card.className = 'layout-card';
    const stars = '★'.repeat(def.level) + '☆'.repeat(3 - def.level);
    card.innerHTML = `<span class="lvl" title="${t(`level${def.level}`)}">${stars} <em>${t(`level${def.level}`)}</em></span>
      <strong></strong><span class="desc"></span>`;
    card.querySelector('strong').textContent = tr(def.name);
    card.querySelector('.desc').textContent = tr(def.desc);
    card.onclick = () => {
      if (!confirm(t('confirmExample'))) return;
      $('layouts-dlg').close();
      const L = def.build();
      L.name = tr(def.name);
      app.setLayout(L);
      plan.fit();
      view3d?.resetCamera();
    };
    list.append(card);
  }
}
$('btn-example').onclick = () => { renderLayoutList(); $('layouts-dlg').showModal(); };
$('layouts-close').onclick = () => $('layouts-dlg').close();
$('btn-save').onclick = () => download(`${fileBase()}.json`, JSON.stringify(serialize(app.layout), null, 1));
$('btn-open').onclick = () => $('file-input').click();
$('file-input').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    app.setLayout(deserialize(JSON.parse(await f.text())));
    plan.fit();
    view3d?.resetCamera();
  } catch (err) {
    console.error(err);
    alert(t('loadError'));
  }
};
$('btn-csv').onclick = () => {
  const rows = [['Fleischmann ref', 'Description', 'Quantity']];
  for (const b of billOfMaterials(app.layout)) rows.push([b.ref, tr(trackType(b.ref)?.name), b.count]);
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(`${fileBase()}-parts.csv`, `﻿${csv}`, 'text/csv');
};
$('btn-undo').onclick = () => app.undo();
$('btn-redo').onclick = () => app.redo();
app.on('history', () => {
  $('btn-undo').disabled = !app.canUndo();
  $('btn-redo').disabled = !app.canRedo();
});
app.emit('history');

// view mode
function updateViewMode() {
  const v = $('views');
  v.className = app.view === 'split' ? 'split' : app.view === '2d' ? 'v2d' : 'v3d';
  document.querySelectorAll('#viewmode button').forEach((b) => b.classList.toggle('active', b.dataset.view === app.view));
  if (view3d) view3d.visible = app.view !== '2d';
  try { localStorage.setItem('ho-view', app.view); } catch { /* ignore */ }
  plan.invalidate();
}
try { app.view = localStorage.getItem('ho-view') || (window.innerWidth < 800 ? '2d' : 'split'); } catch { /* ignore */ }
document.querySelectorAll('#viewmode button').forEach((b) => b.addEventListener('click', () => { app.view = b.dataset.view; updateViewMode(); }));
updateViewMode();

// camera modes
document.querySelectorAll('#cammode button').forEach((b) => b.addEventListener('click', () => view3d?.setCamMode(b.dataset.cam)));
app.on('cammode', (m) => document.querySelectorAll('#cammode button').forEach((b) => b.classList.toggle('active', b.dataset.cam === m)));
app.emit('cammode', 'orbit');

// plan overlay
$('chk-refs').onchange = (e) => { app.showRefs = e.target.checked; plan.invalidate(); };
$('chk-grid').onchange = (e) => { app.showGrid = e.target.checked; plan.invalidate(); };
$('btn-fit').onclick = () => plan.fit();
app.on('board', () => { plan.fit(); view3d?.resetCamera(); });

// language
$('lang').value = getLang();
$('lang').onchange = (e) => { setLang(e.target.value); applyI18n(); app.emit('lang'); };
applyI18n();

// ---------------------------------------------------------------- help
async function showHelp(lang) {
  const body = $('help-body');
  document.querySelectorAll('#help-lang button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  try {
    const [{ marked }, md] = await Promise.all([
      import('marked'),
      fetch(`docs/${lang}/user-guide.md`).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    ]);
    // images and links are relative to the docs folder
    body.innerHTML = marked.parse(md.replace(/\]\((?!https?:|#)([^)]+)\)/g, `](docs/${lang}/$1)`));
  } catch (err) {
    body.textContent = `Could not load the documentation (${err.message}).`;
  }
  body.scrollTop = 0;
}
$('btn-help').onclick = () => { $('help').showModal(); showHelp(getLang()); };
$('help-close').onclick = () => $('help').close();
$('help-body').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  const m = a.getAttribute('href').match(/(en|fr)\/user-guide\.md$/);
  if (m) { e.preventDefault(); showHelp(m[1]); } else if (!a.getAttribute('href').startsWith('#')) a.target = '_blank';
});
document.querySelectorAll('#help-lang button').forEach((b) => b.addEventListener('click', () => showHelp(b.dataset.lang)));

// ---------------------------------------------------------------- toasts
function toast(msg) {
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: msg });
  $('toasts').append(el);
  setTimeout(() => el.remove(), 4000);
}
app.on('toast', toast);

// ------------------------------------------------------------- status bar
app.on('cursor', (p) => {
  $('status').textContent = `x ${p.x.toFixed(0)} · y ${p.y.toFixed(0)} mm`;
});

// --------------------------------------------------------------- keyboard
window.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const k = e.key;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) app.redo(); else app.undo(); return; }
  if (mod && k.toLowerCase() === 'y') { e.preventDefault(); app.redo(); return; }
  if (mod && k.toLowerCase() === 's') { e.preventDefault(); $('btn-save').click(); return; }
  if (mod && k.toLowerCase() === 'a') {
    e.preventDefault();
    app.select([...app.layout.pieces.map((p) => `p:${p.id}`), ...app.layout.scenery.map((s) => `s:${s.id}`)]);
    return;
  }
  if (k === ' ') { plan.spaceDown = true; return; }
  if (k === 'Escape') {
    if (app.anchor || app.tool !== 'select') { app.anchor = null; app.lastChained = null; app.setTool('select'); }
    else app.clearSelection();
    return;
  }
  if (k === 'Delete') { deleteSelection(app); return; }
  if (k === 'Backspace') {
    e.preventDefault();
    if (app.anchor && app.lastChained) removeLast(app);
    else deleteSelection(app);
    return;
  }
  const step = e.shiftKey ? 1 * DEG : 9 * DEG;
  if (k === 'f' || k === 'F') {
    if (app.lastChained && (app.anchor || app.tool === 'track') && findPiece(app.layout, app.lastChained.pid)) flipLast(app);
    else if (app.tool === 'train') { app.trainDir = -app.trainDir; plan.invalidate(); }
    else { app.attachEp++; plan.invalidate(); }
    return;
  }
  if (k === 'q' || k === 'Q' || k === 'e' || k === 'E') {
    const dir = k.toLowerCase() === 'q' ? 1 : -1;
    if (app.tool === 'track') { app.placeRot += dir * step; plan.invalidate(); }
    else if (app.tool === 'scenery') { app.sceneryRot += dir * 15 * DEG; plan.invalidate(); }
    else if (app.selection.size) rotateSelection(app, dir * step);
    return;
  }
  if (k === 'r' || k === 'R') { rotateSelection(app, (e.shiftKey ? 1 : -1) * 90 * DEG); }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') plan.spaceDown = false; });

// ----------------------------------------------------------- main loop
let last = performance.now();
let saveClock = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (app.running && app.layout.trains.length) {
    const events = stepTrains(app.layout, dt);
    for (const ev of events) {
      if (ev.type === 'end') toast(t('evEnd', { name: ev.train.name }));
      else if (ev.type === 'collision') toast(t('evCollision', { name: ev.train.name }));
      else if (ev.type === 'thrown') {
        const p = findPiece(app.layout, ev.pid);
        toast(t('evThrown', { ref: p?.ref || '', name: ev.train.name }));
        app.emit('switch', p);
      }
      if (ev.type !== 'thrown') panels.renderCab();
    }
    if (app.layout.trains.some((tr0) => tr0.speed > 0)) {
      plan.invalidate();
      saveClock += dt;
      if (saveClock > 5) { saveClock = 0; app.scheduleSave(); }
    }
  }
  panels.tick();
  if (app.view !== '3d') plan.tick();
  view3d?.frame(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('beforeunload', () => app.saveLocal());
