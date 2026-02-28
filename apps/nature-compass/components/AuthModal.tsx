import React, { useState } from 'react';
import { X, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

interface AuthModalProps {
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { signIn, signUp, isAuthLoading } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const result = mode === 'login'
            ? await signIn(email, password)
            : await signUp(email, password);

        if (result.error) {
            setError(result.error);
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isAuthLoading}
                        className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isAuthLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : mode === 'login' ? (
                            <><LogIn size={18} /> Sign In</>
                        ) : (
                            <><UserPlus size={18} /> Create Account</>
                        )}
                    </button>

                    <div className="text-center text-sm text-slate-500">
                        {mode === 'login' ? (
                            <>Don't have an account? <button type="button" onClick={() => setMode('signup')} className="text-emerald-600 font-semibold hover:underline">Sign Up</button></>
                        ) : (
                            <>Already have an account? <button type="button" onClick={() => setMode('login')} className="text-emerald-600 font-semibold hover:underline">Sign In</button></>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};
