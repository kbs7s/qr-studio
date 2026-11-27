/* QR Studio — local data store.
 *
 * Keeps app data (history, settings) in IndexedDB, the browser's on-device
 * database, which holds far more than localStorage and is what browsers keep
 * when an app asks for persistent storage. Every value is also mirrored to
 * localStorage as a fallback (private windows, very old browsers) and so that
 * reads can stay synchronous: the app reads from an in-memory copy.
 *
 * Nothing here talks to a server.
 */
(function () {
  'use strict';

  var DB_NAME = 'qr-studio', STORE = 'kv', DB_VERSION = 1;
  var cache = Object.create(null);
  var db = null;

  function lsGet(key) {
    try { var v = localStorage.getItem(key); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; }
  }
  function lsSet(key, value) {
    try {
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* full or blocked: IndexedDB still has it */ }
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('blocked')); };
    });
  }

  function idbAll(database) {
    return new Promise(function (resolve, reject) {
      var out = {};
      var tx = database.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).openCursor();
      req.onsuccess = function () {
        var c = req.result;
        if (c) { out[c.key] = c.value; c.continue(); } else resolve(out);
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbWrite(key, value) {
    if (!db) return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(STORE, 'readwrite');
        if (value === undefined) tx.objectStore(STORE).delete(key);
        else tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = tx.onabort = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }

  // Values written before the database finished opening.
  var pending = Object.create(null);

  var ready = openDb().then(function (database) {
    db = database;
    return idbAll(database);
  }).then(function (stored) {
    Object.keys(stored).forEach(function (k) {
      if (!(k in pending)) cache[k] = stored[k];
    });
    // One-time move of data saved by earlier versions (localStorage only).
    var writes = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('qrstudio.') === 0 && !(k in stored) && !(k in pending)) {
          var v = lsGet(k);
          if (v !== undefined) { cache[k] = v; writes.push(idbWrite(k, v)); }
        }
      }
    } catch (e) { /* ignore */ }
    Object.keys(pending).forEach(function (k) { writes.push(idbWrite(k, pending[k])); });
    pending = Object.create(null);
    return Promise.all(writes);
  }).then(function () { return true; }, function () { return false; });

  function get(key) {
    if (key in cache) return cache[key];
    var v = lsGet(key);
    if (v !== undefined) cache[key] = v;
    return v;
  }

  function set(key, value) {
    cache[key] = value;
    if (value === undefined) delete cache[key];
    lsSet(key, value);
    if (db) idbWrite(key, value); else pending[key] = value;
  }

  // Ask the browser not to clear our data when the device runs low on space.
  function persist() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
    return navigator.storage.persisted().then(function (already) {
      return already || navigator.storage.persist();
    }).catch(function () { return false; });
  }
  function persisted() {
    if (!navigator.storage || !navigator.storage.persisted) return Promise.resolve(false);
    return navigator.storage.persisted().catch(function () { return false; });
  }

  window.LocalStore = {
    ready: ready,           // resolves true when IndexedDB is in use, false on fallback
    get: get,
    set: set,
    remove: function (key) { set(key, undefined); },
    persist: persist,
    persisted: persisted,
    usingDatabase: function () { return !!db; }
  };
})();
