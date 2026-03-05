import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Loader2, LogIn, UserPlus, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { Modal } from '../ui/Modal';

interface AuthModalProps {
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
            const result = await signUp(email, password);
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
                {successMsg && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-start gap-2">
                        <CheckCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                <div>
                    <label className="input-label text-xs uppercase text-slate-400">Email</label>
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
                    <label className="input-label text-xs uppercase text-slate-400">Password</label>
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

