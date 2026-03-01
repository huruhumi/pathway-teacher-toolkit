/**
 * IndexedDB image storage — stores base64 image data outside localStorage.
 * 
 * Key format: `{app}-{recordId}-{type}-{index}`
 * e.g. "nc-abc123-flashcard-0", "esl-xyz-worksheet-2"
 * 
 * Uses a single DB "pathway-images" with one object store "images".
 */

const DB_NAME = 'pathway-images';
const STORE_NAME = 'images';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export const imageStore = {
    async save(key: string, base64: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(base64, key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    },

    async get(key: string): Promise<string | null> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
            req.onerror = () => { db.close(); reject(req.error); };
        });
    },

    async remove(key: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    },

    /** Delete all keys starting with a given prefix */
    async removeByPrefix(prefix: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.openCursor();
            req.onsuccess = () => {
                const cursor = req.result;
                if (cursor) {
                    if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    },

    /** Save multiple images at once */
    async saveBatch(entries: Array<{ key: string; data: string }>): Promise<void> {
        if (entries.length === 0) return;
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const { key, data } of entries) {
                store.put(data, key);
            }
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    },

    /** Get multiple images at once */
    async getBatch(keys: string[]): Promise<Record<string, string | null>> {
        if (keys.length === 0) return {};
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const results: Record<string, string | null> = {};
            let pending = keys.length;
            for (const key of keys) {
                const req = store.get(key);
                req.onsuccess = () => {
                    results[key] = req.result ?? null;
                    if (--pending === 0) { db.close(); resolve(results); }
                };
                req.onerror = () => {
                    results[key] = null;
                    if (--pending === 0) { db.close(); resolve(results); }
                };
            }
        });
    },
};
