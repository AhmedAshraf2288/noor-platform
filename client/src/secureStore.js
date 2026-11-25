// Encrypted client storage. Nothing readable is ever written to localStorage / sessionStorage.
// Data is one AES-256-GCM blob kept in IndexedDB, sealed with a NON-EXTRACTABLE CryptoKey
// (the raw key bytes can never be read back by any script, including devtools snippets).
const DB = 'n', ST = 's';
let mem = {};
let key = null;
let idb = null;
let ready = false;

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const b64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((c) => { s += String.fromCharCode(c); }); return btoa(s); };
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

function openDb() {
  return new Promise((res, rej) => {
    const o = indexedDB.open(DB, 1);
    o.onupgradeneeded = () => o.result.createObjectStore(ST);
    o.onsuccess = () => res(o.result);
    o.onerror = () => rej(o.error);
  });
}
const idbGet = (k) => req(idb.transaction(ST).objectStore(ST).get(k));
const idbPut = (k, v) => req(idb.transaction(ST, 'readwrite').objectStore(ST).put(v, k));

let saving = Promise.resolve();
function persist() {
  if (!key || !idb) return;
  saving = saving.then(async () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(mem)));
    await idbPut('d', iv.length ? b64(iv) + '.' + b64(ct) : '');
  }).catch(() => {});
}

export async function initSecureStore() {
  try {
    if (!window.crypto?.subtle || !window.indexedDB) throw new Error('no-crypto');
    idb = await openDb();
    key = await idbGet('k');
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await idbPut('k', key);
    }
    const blob = await idbGet('d');
    if (blob) {
      try {
        const [iv, ct] = blob.split('.');
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
        mem = JSON.parse(new TextDecoder().decode(pt));
      } catch (e) { mem = {}; }
    }
  } catch (e) { /* memory-only fallback: still nothing in localStorage */ }
  // Migrate + wipe any legacy plain-text entries, then keep both storages empty.
  try {
    for (const k of ['noor-lang', 'noor-dark', 'noor-lite', 'noor-device']) {
      const v = localStorage.getItem(k);
      if (v !== null && mem[k] === undefined) mem[k] = v;
    }
    Object.keys(localStorage).forEach((k) => { if (k.startsWith('noor') || k.startsWith('exam')) { const v = localStorage.getItem(k); if (mem[k] === undefined && v !== null && k.startsWith('exam')) mem[k] = v; } });
    localStorage.clear(); sessionStorage.clear();
  } catch (e) { /* ignore */ }
  ready = true;
  persist();
}
export const sget = (k) => (mem[k] === undefined ? null : mem[k]);
export const sset = (k, v) => { mem[k] = String(v); if (ready) persist(); };
export const sdel = (k) => { delete mem[k]; if (ready) persist(); };
export const sclear = () => { mem = {}; if (ready) persist(); };
