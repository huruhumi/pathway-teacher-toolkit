import React, { useState, useEffect } from 'react';
import { BookOpen, Compass, PenTool, BrainCircuit, GraduationCap, Settings, LogOut, LayoutDashboard, Home } from 'lucide-react';
import { motion } from 'motion/react';

export interface AppLayoutProps {
    children: React.ReactNode;
    currentApp: 'edu-hub' | 'esl-planner' | 'essay-lab' | 'nature-compass' | 'rednote-ops' | 'student-portal';
    userName?: string;
    onLogout?: () => void;
}

const apps = [
    { id: 'edu-hub', name: 'Edu Hub', icon: GraduationCap, path: '/edu-hub/', devPort: 3006, devCmd: 'npm run dev:edu', color: 'text-amber-500' },
    { id: 'esl-planner', name: 'ESL Planner', icon: BookOpen, path: '/planner/', devPort: 3001, devCmd: 'npm run dev:planner', color: 'text-[#1A2B58]' },
    { id: 'essay-lab', name: 'Essay Lab', icon: PenTool, path: '/essay-lab/', devPort: 3002, devCmd: 'npm run dev:essay', color: 'text-[#E91E63]' },
    { id: 'nature-compass', name: 'Nature Compass', icon: Compass, path: '/nature-compass/', devPort: 3003, devCmd: 'npm run dev:nature', color: 'text-emerald-500' },
    { id: 'rednote-ops', name: 'Rednote Ops', icon: BrainCircuit, path: '/academy-ops/', devPort: 3005, devCmd: 'npm run dev:ops', color: 'text-[#E91E63]' },
    { id: 'student-portal', name: 'Student Portal', icon: LayoutDashboard, path: '/student-portal/', devPort: 3007, devCmd: 'npm run dev:student', color: 'text-[#87CEEB]' },
];

/** Resolve the correct href for an app — full URL in dev, relative path in prod */
function getAppHref(app: typeof apps[number]): string {
    if (import.meta.env.DEV) {
        return `http://localhost:${app.devPort}${app.path}`;
    }
    return app.path;
}

/** Probe a port to check if a dev server is running (dev mode only) */
async function probePort(port: number): Promise<boolean> {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1500);
        await fetch(`http://localhost:${port}/`, { mode: 'no-cors', signal: ctrl.signal });
        clearTimeout(timer);
        return true;
    } catch {
        return false;
    }
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, currentApp, userName = 'Teacher', onLogout }) => {
    const isDev = import.meta.env.DEV;
    // Track which ports are alive — current app is always considered alive
    const [livePorts, setLivePorts] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!isDev) return;
        // Probe all non-current app ports on mount
        const otherApps = apps.filter(a => a.id !== currentApp);
        Promise.all(
            otherApps.map(async (app) => {
                const alive = await probePort(app.devPort);
                return alive ? app.devPort : null;
            })
        ).then(results => {
            setLivePorts(new Set(results.filter((p): p is number => p !== null)));
        });
    }, [currentApp, isDev]);

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: 0 }}
                className="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col z-20"
            >
                {/* Brand Area — links back to landing page */}
                <a
                    href={isDev ? 'http://localhost:3000/' : '/'}
                    className="h-16 flex items-center px-6 border-b border-slate-100 flex-shrink-0 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-indigo-200 shadow-sm">
                            <Home size={18} className="text-white" />
                        </div>
                        <span className="font-bold text-slate-800 tracking-tight">Pathway Academy</span>
                    </div>
                </a>

                {/* Global App Switcher */}
                <div className="flex-1 overflow-y-auto py-6 px-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Apps</div>
                    <nav className="space-y-1">
                        {apps.map((app) => {
                            const isActive = currentApp === app.id;
                            const isReachable = !isDev || isActive || livePorts.has(app.devPort);
                            const Icon = app.icon;

                            if (!isReachable) {
                                return (
                                    <div
                                        key={app.id}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-not-allowed opacity-40 select-none"
                                        title={`未启动 — 运行 ${app.devCmd} 启动`}
                                    >
                                        <div className="p-1.5 rounded-lg bg-transparent">
                                            <Icon size={18} className="text-slate-300" />
                                        </div>
                                        <span className="font-semibold text-slate-400">{app.name}</span>
                                        <span className="ml-auto text-[9px] font-bold text-slate-300 uppercase">OFF</span>
                                    </div>
                                );
                            }

                            return (
                                <a
                                    key={app.id}
                                    href={getAppHref(app)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                        ? 'bg-slate-100/80 drop-shadow-sm'
                                        : 'hover:bg-slate-50 text-slate-600'
                                        }`}
                                >
                                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white shadow-sm' : 'bg-transparent group-hover:bg-white group-hover:shadow-sm'} transition-colors`}>
                                        <Icon size={18} className={isActive ? app.color : 'text-slate-400 group-hover:text-slate-600'} />
                                    </div>
                                    <span className={`font-semibold ${isActive ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>
                                        {app.name}
                                    </span>
                                </a>
                            );
                        })}
                    </nav>
                </div>

                {/* User Profile / Logout */}
                <div className="p-4 border-t border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{userName}'s Workspace</p>
                        </div>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Log out"
                            >
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen h-[100dvh] overflow-hidden relative">
                {/* The children components (the actual app) handles its own scrolling */}
                <div className="flex-1 w-full h-full relative">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AppLayout;
