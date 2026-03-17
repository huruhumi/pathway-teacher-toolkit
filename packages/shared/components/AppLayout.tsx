import React, { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, BrainCircuit, Compass, GraduationCap, Home, LayoutDashboard, Lock, LogOut, PenTool, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { APP_REGISTRY, type RegistryAppId } from '../../config/appRegistry';
import { isSupabaseEnabled } from '../services/supabaseClient';
import { listRecordIndexEntries } from '../services/cloudSync';
import { useAuthStore } from '../stores/useAuthStore';
import type { RecordIndexEntry, RecordQualityStatus } from '../types/storage';
import { AuthModal } from './auth/AuthModal';

type AppLayoutId = 'edu-hub' | 'esl-planner' | 'essay-lab' | 'nature-compass' | 'rednote-ops' | 'student-portal';

interface AppStyle {
    icon: LucideIcon;
    color: string;
}

interface AppShellEntry {
    id: AppLayoutId;
    name: string;
    icon: LucideIcon;
    path: string;
    devPort: number;
    devCmd: string;
    color: string;
}

const REGISTRY_ID_TO_LAYOUT_ID: Record<RegistryAppId, AppLayoutId> = {
    planner: 'esl-planner',
    essay: 'essay-lab',
    nature: 'nature-compass',
    ops: 'rednote-ops',
    edu: 'edu-hub',
    student: 'student-portal',
};

const REGISTRY_ID_TO_STYLE: Record<RegistryAppId, AppStyle> = {
    planner: { icon: BookOpen, color: 'text-[#1A2B58]' },
    essay: { icon: PenTool, color: 'text-[#E91E63]' },
    nature: { icon: Compass, color: 'text-emerald-500' },
    ops: { icon: BrainCircuit, color: 'text-[#E91E63]' },
    edu: { icon: GraduationCap, color: 'text-amber-500' },
    student: { icon: LayoutDashboard, color: 'text-[#87CEEB]' },
};

const RECORDS_HASH_BY_APP: Partial<Record<AppLayoutId, string>> = {
    'esl-planner': 'history',
    'essay-lab': 'records',
    'nature-compass': 'saved',
};

const INDEX_APP_ID_TO_LAYOUT_ID: Record<string, AppLayoutId> = {
    'esl-planner': 'esl-planner',
    'essay-lab': 'essay-lab',
    'nature-compass': 'nature-compass',
    'rednote-ops': 'rednote-ops',
    'edu-hub': 'edu-hub',
    'student-portal': 'student-portal',
};

const PROJECT_CRUD_SYNC_EVENT = 'pathway:project-crud-sync';

const apps: AppShellEntry[] = APP_REGISTRY.map((app) => {
    const style = REGISTRY_ID_TO_STYLE[app.id];
    return {
        id: REGISTRY_ID_TO_LAYOUT_ID[app.id],
        name: app.name,
        icon: style.icon,
        path: app.scanPath,
        devPort: app.devPort,
        devCmd: app.devCmd,
        color: style.color,
    };
});

export interface AppLayoutProps {
    children: React.ReactNode;
    currentApp: AppLayoutId;
    userName?: string;
    onLogout?: () => void;
    /** When provided, clicking a finder/review-queue item calls this instead of navigating. */
    onFinderItemClick?: (recordId: string, appId: string) => void;
}

function getLocalDevHost(): string | null {
    if (typeof window === 'undefined') return null;
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return hostname;
    }
    return null;
}

/** Resolve app link: use explicit local dev ports when running on local host. */
function getAppHref(app: AppShellEntry, localDevHost: string | null): string {
    if (localDevHost) {
        return `http://${localDevHost}:${app.devPort}${app.path}`;
    }
    if (import.meta.env.DEV) {
        return `http://localhost:${app.devPort}${app.path}`;
    }
    return app.path;
}

function withHash(href: string, hash?: string): string {
    if (!hash) return href;
    const normalizedHash = hash.startsWith('#') ? hash : `#${hash}`;

    try {
        const url = new URL(href, window.location.origin);
        url.hash = normalizedHash;
        return url.toString();
    } catch {
        return `${href}${normalizedHash}`;
    }
}

/** Append auth tokens for cross-port SSO when a session exists. */
function withSessionTokens(
    href: string,
    session: { access_token?: string; refresh_token?: string } | null | undefined
): string {
    if (!session?.access_token || !session?.refresh_token) return href;

    try {
        const url = new URL(href, window.location.origin);
        url.searchParams.set('_token', session.access_token);
        url.searchParams.set('_refresh', session.refresh_token);
        return url.toString();
    } catch {
        const sep = href.includes('?') ? '&' : '?';
        return `${href}${sep}_token=${encodeURIComponent(session.access_token)}&_refresh=${encodeURIComponent(session.refresh_token)}`;
    }
}

/** Check whether a dev port is alive (used by app switcher in dev mode). */
async function probePort(port: number): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    try {
        await fetch(`http://localhost:${port}/`, { mode: 'no-cors', signal: controller.signal });
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, currentApp, userName = 'Teacher', onLogout, onFinderItemClick }) => {
    const localDevHost = getLocalDevHost();
    const isDev = import.meta.env.DEV || Boolean(localDevHost);
    const { user, session, isInitialized } = useAuthStore();
    const cloudEnabled = isSupabaseEnabled();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [livePorts, setLivePorts] = useState<Set<number>>(new Set());
    const [finderKeyword, setFinderKeyword] = useState('');
    const [finderApp, setFinderApp] = useState<'all' | AppLayoutId>('all');
    const [finderQuality, setFinderQuality] = useState<'all' | Exclude<RecordQualityStatus, 'unknown'>>('needs_review');
    const [finderItems, setFinderItems] = useState<RecordIndexEntry[]>([]);
    const [finderLoading, setFinderLoading] = useState(false);
    const [finderError, setFinderError] = useState<string | null>(null);
    const [finderRefreshNonce, setFinderRefreshNonce] = useState(0);

    const finderApps = useMemo(
        () => apps.filter((app) => Boolean(RECORDS_HASH_BY_APP[app.id])),
        [],
    );

    useEffect(() => {
        if (!isDev) return;

        let cancelled = false;
        const otherApps = apps.filter((app) => app.id !== currentApp);

        Promise.all(
            otherApps.map(async (app) => {
                const alive = await probePort(app.devPort);
                return alive ? app.devPort : null;
            })
        ).then((results) => {
            if (cancelled) return;
            setLivePorts(new Set(results.filter((port): port is number => port !== null)));
        });

        return () => {
            cancelled = true;
        };
    }, [currentApp, isDev]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const requestRefresh = () => setFinderRefreshNonce((prev) => prev + 1);
        const onVisibilityChange = () => {
            if (!document.hidden) requestRefresh();
        };
        window.addEventListener(PROJECT_CRUD_SYNC_EVENT, requestRefresh as EventListener);
        window.addEventListener('focus', requestRefresh);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener(PROJECT_CRUD_SYNC_EVENT, requestRefresh as EventListener);
            window.removeEventListener('focus', requestRefresh);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    useEffect(() => {
        if (!cloudEnabled || !user) {
            setFinderItems([]);
            setFinderLoading(false);
            setFinderError(cloudEnabled ? 'Sign in to search records.' : null);
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setFinderLoading(true);
            setFinderError(null);

            const result = await listRecordIndexEntries({
                ownerId: user.id,
                appId: finderApp === 'all' ? undefined : finderApp,
                keyword: finderKeyword.trim() || undefined,
                qualityStatus: finderQuality === 'all' ? undefined : finderQuality,
                limit: 18,
                offset: 0,
            });

            if (cancelled) return;

            if (result.errorCode) {
                if (result.errorCode === '42P01') {
                    setFinderError('Record index is not ready yet.');
                } else {
                    setFinderError('Search is temporarily unavailable.');
                }
                setFinderItems([]);
                setFinderLoading(false);
                return;
            }

            setFinderItems(result.items);
            setFinderLoading(false);
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [cloudEnabled, finderApp, finderKeyword, finderQuality, finderRefreshNonce, user?.id]);

    const dedupedFinderItems = useMemo(() => {
        const map = new Map<string, RecordIndexEntry>();
        finderItems.forEach((item) => {
            // Use record_id as primary key; fall back to composite key for legacy entries without id
            const key = item.recordId
                || [
                    item.appId,
                    item.recordType,
                    (item.title || '').trim().toLowerCase(),
                    item.textbookLevelKey || '',
                    item.curriculumId || '',
                    item.unitNumber ?? '',
                ].join('::');
            const existing = map.get(key);
            const existingTs = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const currentTs = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
            if (!existing || currentTs >= existingTs) {
                map.set(key, item);
            }
        });
        return Array.from(map.values()).sort((a, b) => {
            const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bt - at;
        });
    }, [finderItems]);

    if (cloudEnabled && isInitialized && !user) {
        return (
            <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
                <div className="flex flex-1 items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-md px-8 text-center"
                    >
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
                            <Lock size={28} className="text-white" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-slate-800">Pathway Academy</h2>
                        <p className="mb-8 text-slate-500">Please sign in to access all features.</p>
                        <button
                            onClick={() => setShowLoginModal(true)}
                            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-8 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-300"
                        >
                            Sign In
                        </button>
                        {showLoginModal && <AuthModal onClose={() => setShowLoginModal(false)} />}
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: 0 }}
                className="z-20 flex w-64 flex-col border-r border-slate-200 bg-white shadow-sm"
            >
                <a
                    href={isDev ? `http://${localDevHost || 'localhost'}:3000/` : '/'}
                    className="flex h-16 flex-shrink-0 items-center border-b border-slate-100 px-6 transition-colors hover:bg-slate-50"
                >
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-200">
                            <Home size={18} className="text-white" />
                        </div>
                        <span className="font-bold tracking-tight text-slate-800">Pathway Academy</span>
                    </div>
                </a>

                <div className="flex-1 overflow-y-auto px-4 py-6">
                    <div className="mb-3 px-2 text-xs font-bold uppercase tracking-widest text-slate-400">Apps</div>
                    <nav className="space-y-1">
                        {apps.map((app) => {
                            const isActive = currentApp === app.id;
                            const isReachable = !isDev || isActive || livePorts.has(app.devPort);
                            const Icon = app.icon;

                            if (!isReachable) {
                                return (
                                    <div
                                        key={app.id}
                                        className="flex cursor-not-allowed select-none items-center gap-3 rounded-xl px-3 py-2.5 opacity-40"
                                        title={`Offline - run ${app.devCmd} to start`}
                                    >
                                        <div className="rounded-lg bg-transparent p-1.5">
                                            <Icon size={18} className="text-slate-300" />
                                        </div>
                                        <span className="font-semibold text-slate-400">{app.name}</span>
                                        <span className="ml-auto text-[9px] font-bold uppercase text-slate-300">OFF</span>
                                    </div>
                                );
                            }

                            return (
                                <a
                                    key={app.id}
                                    href={withSessionTokens(getAppHref(app, localDevHost), session)}
                                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${isActive ? 'bg-slate-100/80 drop-shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <div
                                        className={`rounded-lg p-1.5 transition-colors ${isActive ? 'bg-white shadow-sm' : 'bg-transparent group-hover:bg-white group-hover:shadow-sm'
                                            }`}
                                    >
                                        <Icon
                                            size={18}
                                            className={isActive ? app.color : 'text-slate-400 group-hover:text-slate-600'}
                                        />
                                    </div>
                                    <span
                                        className={`font-semibold ${isActive ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'
                                            }`}
                                    >
                                        {app.name}
                                    </span>
                                </a>
                            );
                        })}
                    </nav>

                    <div className="mt-6 border-t border-slate-100 pt-4">
                        <div className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-slate-400">Review Queue</div>
                        <div className="space-y-2">
                            <div className="relative">
                                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={finderKeyword}
                                    onChange={(e) => setFinderKeyword(e.target.value)}
                                    placeholder="Search records..."
                                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs text-slate-700 outline-none transition-colors focus:border-indigo-300"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={finderApp}
                                    onChange={(e) => setFinderApp(e.target.value as 'all' | AppLayoutId)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300"
                                >
                                    <option value="all">All Apps</option>
                                    {finderApps.map((app) => (
                                        <option key={app.id} value={app.id}>{app.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={finderQuality}
                                    onChange={(e) => setFinderQuality(e.target.value as 'all' | Exclude<RecordQualityStatus, 'unknown'>)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300"
                                >
                                    <option value="all">All Quality</option>
                                    <option value="needs_review">Needs Review</option>
                                    <option value="ok">Ready</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                            {finderLoading ? (
                                <div className="px-2 py-2 text-xs text-slate-500">Searching...</div>
                            ) : finderError ? (
                                <div className="px-2 py-2 text-xs text-amber-700">{finderError}</div>
                            ) : dedupedFinderItems.length === 0 ? (
                                <div className="px-2 py-2 text-xs text-slate-400">No records found.</div>
                            ) : (
                                dedupedFinderItems.map((item) => {
                                    const targetLayoutId = INDEX_APP_ID_TO_LAYOUT_ID[item.appId];
                                    const targetApp = targetLayoutId ? apps.find((app) => app.id === targetLayoutId) : undefined;
                                    const targetHash = targetLayoutId ? RECORDS_HASH_BY_APP[targetLayoutId] : undefined;
                                    const targetHref = targetApp
                                        ? withSessionTokens(withHash(getAppHref(targetApp, localDevHost), targetHash), session)
                                        : undefined;

                                    const quality = item.qualityStatus || 'unknown';
                                    const appLabel = targetApp?.name || item.appId;
                                    const updatedLabel = item.updatedAt
                                        ? new Date(item.updatedAt).toLocaleDateString()
                                        : '';

                                    const row = (
                                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition-colors hover:border-indigo-200 hover:bg-slate-50">
                                            <div className="truncate text-xs font-semibold text-slate-700" title={item.title || 'Untitled Record'}>{item.title || 'Untitled Record'}</div>
                                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                                                <span>{appLabel}</span>
                                                <span>•</span>
                                                {quality === 'needs_review' ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                                        <ShieldAlert size={10} />
                                                        needs_review
                                                    </span>
                                                ) : quality === 'ok' ? (
                                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                                        <ShieldCheck size={10} />
                                                        ready
                                                    </span>
                                                ) : (
                                                    <span className="font-semibold text-slate-500">unknown</span>
                                                )}
                                                {updatedLabel ? (
                                                    <>
                                                        <span>•</span>
                                                        <span>{updatedLabel}</span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    );

                                    if (!targetHref && !onFinderItemClick) {
                                        return (
                                            <div key={`${item.appId}-${item.recordId}`}>
                                                {row}
                                            </div>
                                        );
                                    }

                                    if (onFinderItemClick) {
                                        return (
                                            <button
                                                key={`${item.appId}-${item.recordId}`}
                                                onClick={() => onFinderItemClick(item.recordId, item.appId)}
                                                className="w-full text-left cursor-pointer"
                                            >
                                                {row}
                                            </button>
                                        );
                                    }

                                    return (
                                        <a key={`${item.appId}-${item.recordId}`} href={targetHref}>
                                            {row}
                                        </a>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 border-t border-slate-100 p-4">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900">{userName}'s Workspace</p>
                        </div>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                title="Log out"
                            >
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>

            <main className="relative flex h-screen h-[100dvh] flex-1 flex-col overflow-hidden">
                <div className="relative h-full w-full flex-1">{children}</div>
            </main>
        </div>
    );
};

export default AppLayout;
