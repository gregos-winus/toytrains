// Application state: current layout, selection, tools, undo history,
// persistence and a tiny event bus.

import { createLayout, serialize, deserialize, touch, findPiece } from './model.js';

const STORAGE_KEY = 'ho-layout-v1';
const MAX_HISTORY = 120;

export class App {
  constructor() {
    this.listeners = new Map();
    this.layout = createLayout({ width: 2400, depth: 1200 });
    this.selection = new Set();      // "p:<id>", "s:<id>", "t:<id>"
    this.tool = 'select';
    this.trackRef = null;            // catalogue piece being placed
    this.attachEp = 0;               // endpoint of new piece that connects
    this.placeRot = 0;               // free placement rotation (rad)
    this.anchor = null;              // {pid, ep} open end used for chaining
    this.lastChained = null;         // {pid, anchor, ref, attachEp}
    this.brush = { mode: 'raise', radius: 120, strength: 4, paint: 0 };
    this.sceneryId = null;
    this.sceneryRot = 0;
    this.consist = [];
    this.trainDir = 1;
    this.running = true;
    this.view = 'split';
    this.showRefs = true;
    this.showGrid = true;
    this.activeTrain = null;
    this.history = [];
    this.hIndex = -1;
    this._saveTimer = null;
  }

  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt).add(fn);
  }

  emit(evt, data) {
    for (const fn of this.listeners.get(evt) || []) fn(data);
  }

  // ------------------------------------------------------------------ layout
  setLayout(layout, { keepHistory = false } = {}) {
    this.layout = layout;
    this.selection.clear();
    this.anchor = null;
    this.lastChained = null;
    this.activeTrain = layout.trains[0]?.id ?? null;
    if (!keepHistory) {
      this.history = [];
      this.hIndex = -1;
      this.snapshot();
    }
    this.emit('layout');
    this.emit('terrain');
    this.emit('selection');
    this.emit('trains');
    this.scheduleSave();
  }

  snapshot() {
    const snap = JSON.stringify({ ...serialize(this.layout), trains: [] });
    if (this.history[this.hIndex] === snap) return;
    this.history.length = this.hIndex + 1;
    this.history.push(snap);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.hIndex = this.history.length - 1;
    this.emit('history');
  }

  // Call after any user modification of the layout.
  commit({ terrain = false } = {}) {
    touch(this.layout);
    this.snapshot();
    this.pruneSelection();
    this.emit('layout');
    if (terrain) this.emit('terrain');
    this.emit('selection');
    this.scheduleSave();
  }

  restore(snap) {
    const trains = this.layout.trains;
    const layout = deserialize(JSON.parse(snap));
    // trains are not part of the undo history: keep the running ones when
    // their track still exists
    layout.trains = trains.filter((t) => t.trail.every((e) => findPiece(layout, e.pid)));
    layout.nextId = Math.max(layout.nextId, this.layout.nextId);
    this.layout = layout;
    this.pruneSelection();
    this.anchor = null;
    this.lastChained = null;
    this.emit('layout');
    this.emit('terrain');
    this.emit('selection');
    this.emit('trains');
    this.emit('history');
    this.scheduleSave();
  }

  undo() {
    if (this.hIndex <= 0) return;
    this.hIndex--;
    this.restore(this.history[this.hIndex]);
  }

  redo() {
    if (this.hIndex >= this.history.length - 1) return;
    this.hIndex++;
    this.restore(this.history[this.hIndex]);
  }

  canUndo() { return this.hIndex > 0; }
  canRedo() { return this.hIndex < this.history.length - 1; }

  // --------------------------------------------------------------- selection
  pruneSelection() {
    const L = this.layout;
    for (const key of [...this.selection]) {
      const [k, idStr] = key.split(':');
      const id = +idStr;
      const ok = k === 'p' ? !!findPiece(L, id)
        : k === 's' ? L.scenery.some((s) => s.id === id)
          : L.trains.some((t) => t.id === id);
      if (!ok) this.selection.delete(key);
    }
    if (this.anchor && !findPiece(L, this.anchor.pid)) this.anchor = null;
  }

  select(keys, add = false) {
    if (!add) this.selection.clear();
    for (const k of keys) this.selection.add(k);
    this.emit('selection');
  }

  toggleSelect(key) {
    if (this.selection.has(key)) this.selection.delete(key);
    else this.selection.add(key);
    this.emit('selection');
  }

  clearSelection() {
    if (!this.selection.size) return;
    this.selection.clear();
    this.emit('selection');
  }

  selectedPieces() {
    return [...this.selection].filter((k) => k.startsWith('p:')).map((k) => findPiece(this.layout, +k.slice(2))).filter(Boolean);
  }

  selectedScenery() {
    const ids = new Set([...this.selection].filter((k) => k.startsWith('s:')).map((k) => +k.slice(2)));
    return this.layout.scenery.filter((s) => ids.has(s.id));
  }

  // -------------------------------------------------------------------- tools
  setTool(tool, opts = {}) {
    this.tool = tool;
    if (tool !== 'track') this.trackRef = null;
    if (tool !== 'scenery') this.sceneryId = null;
    Object.assign(this, opts);
    this.emit('tool');
  }

  // ------------------------------------------------------------- persistence
  scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveLocal(), 800);
  }

  saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(this.layout)));
    } catch { /* storage full or unavailable */ }
  }

  loadLocal() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return null;
      return deserialize(JSON.parse(s));
    } catch {
      return null;
    }
  }
}
