const DB = 'partexplode-models-v1';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('models');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new Error('Model storage is unavailable. Export your project to keep a copy.'));
  });
}
export async function storeAsset(id: string, buffer: ArrayBuffer): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('models', 'readwrite'); tx.objectStore('models').put(buffer, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
  finally { db.close(); }
}
export async function loadAsset(id: string): Promise<ArrayBuffer | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const tx = db.transaction('models'); const req = tx.objectStore('models').get(id); req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
export function encodeAsset(buffer: ArrayBuffer) { const bytes = new Uint8Array(buffer); let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text); }
export function decodeAsset(value: string) { if (value.length > 35_000_000) throw new Error('This model is too large. Import a GLB under 25 MB.'); const text = atob(value), bytes = new Uint8Array(text.length); for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i); return bytes.buffer; }
export function download(name: string, data: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 10000); }
