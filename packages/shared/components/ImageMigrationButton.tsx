/**
 * One-click button to migrate images from IndexedDB to Supabase Storage.
 * Mount this in any app's settings/records area.
 */
import React, { useState } from 'react';
import { imageStorage } from '../imageStorage';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export const ImageMigrationButton: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState<{ migrated: number; failed: number; skipped: number } | null>(null);

    const handleMigrate = async () => {
        if (status === 'running') return;
        setStatus('running');
        setProgress({ done: 0, total: 0 });
        setResult(null);

        try {
            const res = await imageStorage.migrateFromIndexedDB((done, total) => {
                setProgress({ done, total });
            });
            setResult(res);
            setStatus('done');
        } catch (err) {
            console.error('[ImageMigration] failed:', err);
            setStatus('error');
        }
    };

    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
            <div className="flex items-center gap-2 mb-2">
                <Upload size={16} className="text-blue-500" />
                <span className="font-medium text-sm">Migrate Images to Cloud</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Upload locally cached images to Supabase Storage. This ensures images survive browser cache clears and are accessible across devices.
            </p>

            {status === 'idle' && (
                <button
                    onClick={handleMigrate}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    title="Migrate images to Supabase Storage"
                >
                    Start Migration
                </button>
            )}

            {status === 'running' && (
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>
                        Uploading... {progress.done}/{progress.total}
                        {progress.total > 0 && ` (${Math.round(progress.done / progress.total * 100)}%)`}
                    </span>
                </div>
            )}

            {status === 'done' && result && (
                <div className="flex items-start gap-2 text-xs">
                    <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <div>
                        <span className="text-green-600 dark:text-green-400 font-medium">Migration complete!</span>
                        <div className="text-slate-500 dark:text-slate-400 mt-1">
                            {result.migrated > 0 && <span>✅ {result.migrated} uploaded · </span>}
                            {result.skipped > 0 && <span>⏭ {result.skipped} skipped · </span>}
                            {result.failed > 0 && <span className="text-red-500">❌ {result.failed} failed</span>}
                            {result.migrated === 0 && result.skipped === 0 && result.failed === 0 && (
                                <span>No images to migrate.</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-500">
                    <AlertCircle size={14} />
                    <span>Migration failed. Check console for details.</span>
                </div>
            )}
        </div>
    );
};
