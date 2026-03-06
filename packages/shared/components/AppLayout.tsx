import React from 'react';
import { BookOpen, Compass, PenTool, BrainCircuit, GraduationCap, Settings, LogOut, LayoutDashboard } from 'lucide-react';
import { motion } from 'motion/react';

export interface AppLayoutProps {
    children: React.ReactNode;
    currentApp: 'edu-hub' | 'esl-planner' | 'essay-lab' | 'nature-compass' | 'rednote-ops' | 'student-portal';
    userName?: string;
    onLogout?: () => void;
}

const apps = [
    { id: 'edu-hub', name: 'Edu Hub', icon: GraduationCap, path: '/edu-hub', color: 'text-amber-500' },
    { id: 'esl-planner', name: 'ESL Planner', icon: BookOpen, path: '/esl-planner', color: 'text-[#1A2B58]' },
    { id: 'essay-lab', name: 'Essay Lab', icon: PenTool, path: '/essay-lab', color: 'text-[#E91E63]' },
    { id: 'nature-compass', name: 'Nature Compass', icon: Compass, path: '/nature-compass', color: 'text-emerald-500' },
    { id: 'rednote-ops', name: 'Rednote Ops', icon: BrainCircuit, path: '/rednote-ops', color: 'text-[#E91E63]' },
    { id: 'student-portal', name: 'Student Portal', icon: LayoutDashboard, path: '/student-portal', color: 'text-[#87CEEB]' },
];

export const AppLayout: React.FC<AppLayoutProps> = ({ children, currentApp, userName = 'Teacher', onLogout }) => {
    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -250 }}
                animate={{ x: 0 }}
                className="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col z-20"
            >
                {/* Brand Area */}
                <div className="h-16 flex items-center px-6 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-indigo-200 shadow-sm">
                            <span className="text-white font-bold text-lg">P</span>
                        </div>
                        <span className="font-bold text-slate-800 tracking-tight">Pathway Academy</span>
                    </div>
                </div>

                {/* Global App Switcher */}
                <div className="flex-1 overflow-y-auto py-6 px-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Apps</div>
                    <nav className="space-y-1">
                        {apps.map((app) => {
                            const isActive = currentApp === app.id;
                            const Icon = app.icon;
                            return (
                                <a
                                    key={app.id}
                                    href={app.path}
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
                            <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
                            <p className="text-xs text-slate-500 truncate">Workspace</p>
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
