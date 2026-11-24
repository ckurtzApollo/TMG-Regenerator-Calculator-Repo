/**
 * Saved regenerator designs.
 *
 * Where designs are kept, picked automatically:
 *  - Published on claude.ai: the artifact's private per-person store (db capability), so your
 *    designs follow your Claude account and nobody else on the artifact can see them.
 *  - Opened from the git repo or a downloaded file: the browser's localStorage.
 *  - Neither available: kept for this session only.
 * Design files (.json) can always be exported and imported, so designs can be shared or committed.
 *
 * Works in the browser (window.RegenStorage) and in Node (require('./storage.js')) for tests.
 */
(function (root) {
  'use strict';

  const FILE_FORMAT = 'tmg-regenerator-designs';
  const FILE_VERSION = 1;
  const LS_KEY = 'tmg-regenerator-designs-v1';
  const NUMERIC_KEYS = ['f', 'p', 'ThC', 'TcC', 'LMM', 'Dh', 'Dd0', 'Vm', 'Vh', 'Dd', 'Dt', 'Do',
    'N', 'b', 'h', 'wire', 'overcut', 'minFin', 'steelOverride', 'thin', 's', 'ecc', 'V0', 'theta', 'otherLoss', 'otherLossAir', 'etaAlt', 'Qother'];
  const GASES = ['helium', 'air'];
  const MODES = ['contour', 'plunge'];

  /** Keep only known inputs with sane values; anything else in a file or store is dropped. */
  function cleanValues(v) {
    const out = {};
    if (!v || typeof v !== 'object') return out;
    for (const k of NUMERIC_KEYS) {
      const x = Number(v[k]);
      if (Number.isFinite(x)) out[k] = x;
    }
    if (MODES.includes(v.mode)) out.mode = v.mode;
    if (GASES.includes(v.gas)) out.gas = v.gas;
    return out;
  }

  function cleanName(name) {
    return String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
  }

  /** Document id from a name: same name saves over the same design. */
  function slugify(name) {
    const s = cleanName(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (s || 'design').slice(0, 60);
  }

  function makeRecord(name, values) {
    const n = cleanName(name);
    return { id: slugify(n), name: n, savedAt: new Date().toISOString(), values: cleanValues(values) };
  }

  function cleanRecord(r) {
    if (!r || typeof r !== 'object') return null;
    const name = cleanName(r.name);
    if (!name) return null;
    const values = cleanValues(r.values);
    if (Object.keys(values).length < 10) return null;          // not a usable design
    const savedAt = typeof r.savedAt === 'string' ? r.savedAt.slice(0, 40) : '';
    return { id: slugify(name), name, savedAt, values };
  }

  /** Text of a design file holding one or more designs. */
  function toFile(records) {
    return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, designs: records.map(cleanRecord).filter(Boolean) }, null, 2) + '\n';
  }

  /** Designs from a file's text; throws with a readable message if it isn't a design file. */
  function parseFile(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('That file isn’t valid JSON.'); }
    const list = Array.isArray(data) ? data : (data && data.format === FILE_FORMAT ? data.designs : null);
    if (!Array.isArray(list)) throw new Error('That file isn’t a regenerator design file.');
    const out = list.map(cleanRecord).filter(Boolean);
    if (!out.length) throw new Error('No usable designs in that file.');
    return out;
  }

  // ---------- stores ----------
  function memoryStore() {
    const map = new Map();
    return {
      kind: 'session',
      note: 'This view can’t keep designs after you close it. Export a design file to keep it.',
      async list() { return [...map.values()]; },
      async save(rec) { map.set(rec.id, rec); },
      async remove(id) { map.delete(id); },
    };
  }

  function browserStore(ls) {
    const read = () => {
      try { const o = JSON.parse(ls.getItem(LS_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
    };
    const write = o => { ls.setItem(LS_KEY, JSON.stringify(o)); };
    return {
      kind: 'browser',
      note: 'Saved in this browser on this computer. Export a design file to share it or commit it to git.',
      async list() { return Object.values(read()).map(cleanRecord).filter(Boolean); },
      async save(rec) { const o = read(); o[rec.id] = rec; write(o); },
      async remove(id) { const o = read(); delete o[id]; write(o); },
    };
  }

  function accountStore(db, uid) {
    const col = db.collection('data/users/' + uid + '/designs');
    return {
      kind: 'account',
      note: 'Saved privately to your Claude account for this calculator. Export a design file to share it or commit it to git.',
      async list() {
        const snap = await col.get();
        return snap.docs.filter(d => d.exists).map(d => cleanRecord(d.data())).filter(Boolean);
      },
      async save(rec) { await col.doc(rec.id).set(rec); },
      async remove(id) { await col.doc(id).delete(); },
    };
  }

  function localStorageOrNull() {
    try {
      const ls = root.localStorage;
      const k = LS_KEY + '-probe';
      ls.setItem(k, '1'); ls.removeItem(k);
      return ls;
    } catch (e) { return null; }
  }

  /** Pick the best store available in this view. Never rejects. */
  async function createStore() {
    const c = root.claude;
    if (c && typeof c.use === 'function') {
      try {
        const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
        const uid = user ? await user.id() : null;
        if (db && uid) return accountStore(db, uid);
      } catch (e) { /* fall through */ }
    }
    const ls = localStorageOrNull();
    return ls ? browserStore(ls) : memoryStore();
  }

  /** Save text as a file: claude.ai downloads capability when published, a plain link otherwise. */
  async function saveFile(filename, text) {
    const c = root.claude;
    if (c && typeof c.use === 'function') {
      try {
        const dl = await c.use('downloads');
        if (dl) { await dl.save({ filename, data: text }); return 'saved'; }
      } catch (e) {
        if (e && (e.code === 'declined' || e.code === 'cancelled' || e.code === 'aborted')) return 'declined';
      }
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = root.document.createElement('a');
    a.href = url; a.download = filename;
    root.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'saved';
  }

  const api = { createStore, saveFile, toFile, parseFile, makeRecord, cleanValues, slugify, FILE_FORMAT, NUMERIC_KEYS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RegenStorage = api;
})(typeof self !== 'undefined' ? self : this);
