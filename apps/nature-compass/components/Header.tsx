import React from 'react';
import { Compass, FolderOpen, ArrowLeft, Cloud, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { isSupabaseEnabled } from '../services/supabaseClient';

interface HeaderProps {
  currentView: 'home' | 'saved';
  onNavigate: (view: 'home' | 'saved') => void;
  onShowAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onShowAuth }) => {
  const { user, signOut } = useAuthStore();
  const cloudEnabled = isSupabaseEnabled();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onNavigate('home')}
        >
          <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Compass size={20} />
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">
            Nature Compass
          </span>
        </div>

        <div className="flex items-center gap-3">
          {currentView === 'home' ? (
            <button
              onClick={() => onNavigate('saved')}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all"
            >
              <FolderOpen size={18} />
              <span className="hidden sm:inline">My Projects</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-all"
            >
              <ArrowLeft size={18} />
              <span>Back to Planner</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* Auth Section */}
          {cloudEnabled && (
            user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                  <Cloud size={14} />
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.email}</span>
                </div>
                <button
                  onClick={signOut}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={onShowAuth}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all border border-slate-200"
              >
                <User size={16} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )
          )}

          <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 hidden sm:inline-block">
            v1.3 • TESOL Aligned
          </span>
        </div>
      </div>
    </header>
  );
};
