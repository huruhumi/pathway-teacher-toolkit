/**
 * Supabase Storage image service — stores images in Supabase Storage bucket,
 * with IndexedDB fallback when Supabase is unavailable or user is unauthenticated.
 *
 * API is 100% compatible with imageStore.ts (drop-in replacement).
 *
 * Key format: `{app}-{recordId}-{type}-{index}`
 * Storage path: `{app}/{recordId}/{type}-{index}.png`
 */

import { supabase, isSupabaseEnabled } from './services/supabaseClient';
import { imageStore } from './imageStore';

const BUCKET = 'generated-images';
const QUOTA_LIMIT_MB = 1024; // 1 GB free plan
const QUOTA_WARNING_THRESHOLD = 0.8; // 80%

let _uploadCounter = 0;
let _lastQuotaCheck: { usedMB: number; timestamp: number } | null = null;
const QUOTA_CACHE_MS = 5 * 60 * 1000; // 5 min cache
const QUOTA_CHECK_INTERVAL = 50; // every N uploads

// ─── Helpers ───────────────────────────────────────────────

/** Convert IndexedDB key to Storage path: `esl-abc-fc-0` → `esl/abc/fc-0.png` */
function keyToPath(key: string): string {
    // key format: {app}-{recordId}-{type...}
    // app is always a short prefix (esl, nc, rn), recordId is UUID
    const firstDash = key.indexOf('-');
    if (firstDash === -1) return `misc/${key}.png`;

    const app = key.substring(0, firstDash);
    const rest = key.substring(firstDash + 1);

    // recordId is a UUID (36 chars with dashes)
    // Find the end of the UUID by looking for the pattern
    const uuidMatch = rest.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i);
    if (uuidMatch) {
        const recordId = uuidMatch[1];
        const suffix = uuidMatch[2];
        return `${app}/${recordId}/${suffix}.png`;
    }

    // Fallback: simple split for non-UUID IDs
    const secondDash = rest.indexOf('-');
    if (secondDash === -1) return `${app}/${rest}.png`;

    const recordId = rest.substring(0, secondDash);
    const suffix = rest.substring(secondDash + 1);
    return `${app}/${recordId}/${suffix}.png`;
}

/** Get the public URL for a storage path */
function getPublicUrl(path: string): string {
    if (!supabase) return '';
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/** Convert base64 data URL to Uint8Array + content type */
function base64ToBlob(base64: string): { data: Uint8Array; contentType: string } {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        // Raw base64 without data URL prefix — assume PNG
        const raw = atob(base64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return { data: arr, contentType: 'image/png' };
    }
    const contentType = match[1];
    const raw = atob(match[2]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return { data: arr, contentType };
}

/** Check if Supabase is available and user is authenticated */
async function canUseSupabase(): Promise<boolean> {
    if (!isSupabaseEnabled() || !supabase) return false;
    try {
        const { data } = await supabase.auth.getUser();
        return !!data?.user;
    } catch {
        return false;
    }
}

// ─── Core API ──────────────────────────────────────────────

export const imageStorage = {
    /**
     * Save an image. Returns public URL if uploaded to Supabase,
     * or the original base64 if falling back to IndexedDB.
     */
    async save(key: string, base64: string): Promise<string> {
        const useSupabase = await canUseSupabase();

        if (useSupabase) {
            try {
                const path = keyToPath(key);
                const { data: blobData, contentType } = base64ToBlob(base64);

                const { error } = await supabase!.storage.from(BUCKET).upload(path, blobData, {
                    contentType,
                    upsert: true,
                });

                if (error) {
                    console.warn('[imageStorage] upload failed, falling back to IndexedDB:', error.message);
                    await imageStore.save(key, base64);
                    return base64;
                }

                // Periodic quota check
                _uploadCounter++;
                if (_uploadCounter % QUOTA_CHECK_INTERVAL === 0) {
                    this.checkStorageQuota().catch(() => { /* silent */ });
                }

                return getPublicUrl(path);
            } catch (err) {
                console.warn('[imageStorage] upload exception, falling back to IndexedDB:', err);
                await imageStore.save(key, base64);
                return base64;
            }
        }

        // Fallback to IndexedDB
        await imageStore.save(key, base64);
        return base64;
    },

    /**
     * Get an image URL by key. For Supabase, returns the public URL directly
     * (no network request needed). For IndexedDB fallback, reads from store.
     */
    async get(key: string): Promise<string | null> {
        // If key looks like a URL already, return it
        if (key.startsWith('http')) return key;
        if (key.startsWith('data:')) return key;

        const useSupabase = await canUseSupabase();

        if (useSupabase) {
            const path = keyToPath(key);
            const url = getPublicUrl(path);

            // Verify the file exists (HEAD-like check via list)
            try {
                const dir = path.substring(0, path.lastIndexOf('/'));
                const filename = path.substring(path.lastIndexOf('/') + 1);
                const { data } = await supabase!.storage.from(BUCKET).list(dir, {
                    search: filename,
                    limit: 1,
                });
                if (data && data.length > 0) return url;
            } catch { /* fall through to IndexedDB */ }
        }

        // Fallback to IndexedDB
        return imageStore.get(key);
    },

    /** Remove an image by key */
    async remove(key: string): Promise<void> {
        const useSupabase = await canUseSupabase();

        if (useSupabase) {
            const path = keyToPath(key);
            await supabase!.storage.from(BUCKET).remove([path]).catch((err) =>
                console.warn('[imageStorage] remove failed:', err)
            );
        }

        // Also clean IndexedDB (may have old data)
        await imageStore.remove(key).catch(() => { });
    },

    /** Delete all files matching a key prefix */
    async removeByPrefix(prefix: string): Promise<void> {
        const useSupabase = await canUseSupabase();

        if (useSupabase) {
            try {
                // Convert key prefix to storage directory path
                const firstDash = prefix.indexOf('-');
                let dir: string;
                if (firstDash === -1) {
                    dir = prefix;
                } else {
                    const app = prefix.substring(0, firstDash);
                    const rest = prefix.substring(firstDash + 1).replace(/-$/, ''); // strip trailing dash
                    dir = `${app}/${rest}`;
                }

                // List all files in the directory
                const { data } = await supabase!.storage.from(BUCKET).list(dir, { limit: 1000 });
                if (data && data.length > 0) {
                    const paths = data.map((f) => `${dir}/${f.name}`);
                    await supabase!.storage.from(BUCKET).remove(paths);
                }
            } catch (err) {
                console.warn('[imageStorage] removeByPrefix failed:', err);
            }
        }

        // Also clean IndexedDB
        await imageStore.removeByPrefix(prefix).catch(() => { });
    },

    /** Save multiple images at once. Returns key→URL map. */
    async saveBatch(entries: Array<{ key: string; data: string }>): Promise<Record<string, string>> {
        if (entries.length === 0) return {};

        const results: Record<string, string> = {};

        const useSupabase = await canUseSupabase();

        if (useSupabase) {
            // Upload all to Supabase, fallback individual failures to IndexedDB
            const idbFallbacks: Array<{ key: string; data: string }> = [];

            for (const entry of entries) {
                try {
                    const path = keyToPath(entry.key);
                    const { data: blobData, contentType } = base64ToBlob(entry.data);

                    const { error } = await supabase!.storage.from(BUCKET).upload(path, blobData, {
                        contentType,
                        upsert: true,
                    });

                    if (error) {
                        console.warn(`[imageStorage] batch upload failed for ${entry.key}:`, error.message);
                        idbFallbacks.push(entry);
                        results[entry.key] = entry.data; // Return base64 as fallback
                    } else {
                        results[entry.key] = getPublicUrl(path);
                    }
                } catch (err) {
                    console.warn(`[imageStorage] batch upload exception for ${entry.key}:`, err);
                    idbFallbacks.push(entry);
                    results[entry.key] = entry.data;
                }
            }

            // Save failures to IndexedDB
            if (idbFallbacks.length > 0) {
                await imageStore.saveBatch(idbFallbacks).catch(() => { });
            }

            // Periodic quota check
            _uploadCounter += entries.length;
            if (_uploadCounter >= QUOTA_CHECK_INTERVAL) {
                _uploadCounter = 0;
                this.checkStorageQuota().catch(() => { });
            }

            return results;
        }

        // Full IndexedDB fallback
        await imageStore.saveBatch(entries);
        for (const entry of entries) {
            results[entry.key] = entry.data; // Return base64
        }
        return results;
    },

    /** Get multiple images at once */
    async getBatch(keys: string[]): Promise<Record<string, string | null>> {
        if (keys.length === 0) return {};

        const results: Record<string, string | null> = {};
        const idbKeys: string[] = [];

        for (const key of keys) {
            if (key.startsWith('http')) {
                results[key] = key; // Already a URL
            } else if (key.startsWith('data:')) {
                results[key] = key; // Already base64
            } else {
                idbKeys.push(key); // Need to resolve
            }
        }

        // For remaining keys, try IndexedDB (they're old-format keys)
        if (idbKeys.length > 0) {
            const idbResults = await imageStore.getBatch(idbKeys);
            Object.assign(results, idbResults);
        }

        return results;
    },

    /** Check storage usage against quota */
    async checkStorageQuota(): Promise<{ usedMB: number; limitMB: number; warning: boolean }> {
        // Return cached result if fresh
        if (_lastQuotaCheck && Date.now() - _lastQuotaCheck.timestamp < QUOTA_CACHE_MS) {
            return {
                usedMB: _lastQuotaCheck.usedMB,
                limitMB: QUOTA_LIMIT_MB,
                warning: _lastQuotaCheck.usedMB > QUOTA_LIMIT_MB * QUOTA_WARNING_THRESHOLD,
            };
        }

        if (!isSupabaseEnabled() || !supabase) {
            return { usedMB: 0, limitMB: QUOTA_LIMIT_MB, warning: false };
        }

        try {
            let totalBytes = 0;
            // List root folders
            const { data: folders } = await supabase.storage.from(BUCKET).list('', { limit: 100 });
            if (folders) {
                for (const folder of folders) {
                    if (folder.id) {
                        // It's a file at root level
                        totalBytes += (folder.metadata as any)?.size || 0;
                    } else {
                        // It's a folder — list contents
                        const { data: files } = await supabase.storage.from(BUCKET).list(folder.name, { limit: 10000 });
                        if (files) {
                            for (const file of files) {
                                totalBytes += (file.metadata as any)?.size || 0;
                            }
                        }
                    }
                }
            }

            const usedMB = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
            _lastQuotaCheck = { usedMB, timestamp: Date.now() };

            const warning = usedMB > QUOTA_LIMIT_MB * QUOTA_WARNING_THRESHOLD;
            if (warning) {
                console.warn(`[imageStorage] ⚠️ Storage usage: ${usedMB}/${QUOTA_LIMIT_MB} MB (${Math.round(usedMB / QUOTA_LIMIT_MB * 100)}%). Consider upgrading Supabase plan.`);
                // Toast warning — import dynamically to avoid circular deps
                try {
                    const { useToast } = await import('./stores/useToast');
                    useToast.getState().warning(
                        `Storage space: ${usedMB}/${QUOTA_LIMIT_MB} MB used (${Math.round(usedMB / QUOTA_LIMIT_MB * 100)}%). Consider upgrading your Supabase plan.`
                    );
                } catch { /* silent */ }
            }

            return { usedMB, limitMB: QUOTA_LIMIT_MB, warning };
        } catch (err) {
            console.warn('[imageStorage] quota check failed:', err);
            return { usedMB: 0, limitMB: QUOTA_LIMIT_MB, warning: false };
        }
    },

    /**
     * Migrate all images from IndexedDB to Supabase Storage.
     * Returns { migrated: number, failed: number, skipped: number }.
     */
    async migrateFromIndexedDB(
        onProgress?: (done: number, total: number) => void
    ): Promise<{ migrated: number; failed: number; skipped: number }> {
        if (!isSupabaseEnabled() || !supabase) {
            return { migrated: 0, failed: 0, skipped: 0 };
        }

        const useSupabase = await canUseSupabase();
        if (!useSupabase) {
            return { migrated: 0, failed: 0, skipped: 0 };
        }

        // Open IndexedDB directly to enumerate all keys
        const DB_NAME = 'pathway-images';
        const STORE_NAME = 'images';

        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Get all keys
        const allKeys = await new Promise<string[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAllKeys();
            req.onsuccess = () => {
                resolve((req.result as string[]).filter(k => typeof k === 'string'));
            };
            req.onerror = () => reject(req.error);
        });

        let migrated = 0;
        let failed = 0;
        let skipped = 0;

        for (let i = 0; i < allKeys.length; i++) {
            const key = allKeys[i];
            onProgress?.(i, allKeys.length);

            // Read the base64 data
            const data = await imageStore.get(key);
            if (!data || !data.startsWith('data:')) {
                skipped++;
                continue;
            }

            // Upload to Supabase
            try {
                const path = keyToPath(key);
                const { data: blobData, contentType } = base64ToBlob(data);
                const { error } = await supabase!.storage.from(BUCKET).upload(path, blobData, {
                    contentType,
                    upsert: true,
                });

                if (error) {
                    console.warn(`[migrate] Failed ${key}:`, error.message);
                    failed++;
                } else {
                    migrated++;
                }
            } catch (err) {
                console.warn(`[migrate] Exception ${key}:`, err);
                failed++;
            }
        }

        onProgress?.(allKeys.length, allKeys.length);
        db.close();

        return { migrated, failed, skipped };
    },
};
