import React, { useState } from 'react';
import { X, Lock, User, Loader2, LogIn, UserPlus, CheckCircle, Mail } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { Modal } from '../ui/Modal';

interface AuthModalProps {
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const { signIn, signUp, isAuthLoading } = useAuthStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (mode === 'login') {
            const result = await signIn(email, password);
            if (result.error) {
                setError(result.error);
            } else {
                onClose();
            }
        } else {
            if (!username.trim()) {
                setError('Username is required');
                return;
            }
            const result = await signUp(email, password, username.trim());
            if (result.error) {
                setError(result.error);
            } else if (result.needsConfirmation) {
                setSuccessMsg('Account created! Please check your email to confirm, then sign in.');
                setMode('login');
            } else {
                onClose();
            }
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-md" className="rounded-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                </h2>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-500/20">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm rounded-lg border border-emerald-200 dark:border-emerald-500/20 flex items-start gap-2">
                        <CheckCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                {mode === 'signup' && (
                    <div>
                        <label className="input-label text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                            <User size={12} /> Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="input-field"
                            placeholder="Your display name"
                            required
                        />
                    </div>
                )}

                <div>
                    <label className="input-label text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                        <Mail size={12} /> Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field"
                        placeholder="you@example.com"
                        required
                    />
                </div>

                <div>
                    <label className="input-label text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                        <Lock size={12} /> Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field"
                        placeholder="••••••••"
                        required
                        minLength={6}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="btn btn-primary w-full py-3"
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
                        <>Don't have an account? <button type="button" onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }} className="text-emerald-600 font-semibold hover:underline">Sign Up</button></>
                    ) : (
                        <>Already have an account? <button type="button" onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} className="text-emerald-600 font-semibold hover:underline">Sign In</button></>
                    )}
                </div>
            </form>
        </Modal>
    );
};
