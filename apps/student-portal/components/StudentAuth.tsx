import React, { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuthStore } from '@shared/stores/useAuthStore';
import { supabase } from '@shared/services/supabaseClient';
import { KeyRound, Mail, Lock, Loader2, UserPlus, CheckCircle2, User, LogIn } from 'lucide-react';
import { BodyContainer } from '@shared/components/BodyContainer';
import { PageLayout } from '@shared/components/PageLayout';

const REGISTERED_KEY = 'student_portal_registered';

export const StudentAuth: React.FC = () => {
    const { lang } = useLanguage();
    const { signUp, signIn, isAuthLoading } = useAuthStore();

    const hasRegistered = useMemo(() => {
        try { return localStorage.getItem(REGISTERED_KEY) === '1'; } catch { return false; }
    }, []);

    const [mode, setMode] = useState<'login' | 'register'>(hasRegistered ? 'login' : 'register');
    const [inviteCode, setInviteCode] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const isRegister = mode === 'register';

    const switchMode = (m: 'login' | 'register') => {
        setMode(m);
        setError('');
        setSuccessMsg('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);
        try {
            if (isRegister) {
                await handleRegister();
            } else {
                await handleLogin();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!inviteCode.trim() || inviteCode.trim().length < 6) {
            setError(lang === 'zh' ? '请输入有效的6位邀请码' : 'Please enter a valid 6-character invite code');
            return;
        }
        if (!username.trim()) {
            setError(lang === 'zh' ? '请输入用户名' : 'Username is required');
            return;
        }

        // Step 1: Sign up
        const result = await signUp(email, password, username.trim());
        if (result.error) { setError(result.error); return; }

        // Step 2: Confirm email via RPC (bypass email verification for students)
        if (supabase) {
            await supabase.rpc('confirm_student_email');
        }

        // Step 3: Sign in (email now confirmed)
        const loginResult = await signIn(email, password);
        if (loginResult.error) {
            setSuccessMsg(lang === 'zh'
                ? '账号已创建！请切换到"登录"完成登录。'
                : 'Account created! Switch to "Sign In" to continue.');
            setMode('login');
            return;
        }

        // Step 4: Link invite code
        await linkAccount();
    };

    const handleLogin = async () => {
        let result = await signIn(email, password);

        // Handle "Email not confirmed" — auto-confirm and retry
        if (result.error && result.error.toLowerCase().includes('email not confirmed') && supabase) {
            await supabase.rpc('confirm_student_email');
            result = await signIn(email, password);
        }

        if (result.error) { setError(result.error); return; }
        try { localStorage.setItem(REGISTERED_KEY, '1'); } catch { }
        window.location.reload();
    };

    const linkAccount = async () => {
        if (!supabase) return;
        try {
            const { data, error: rpcError } = await supabase.rpc('link_student_account', {
                code: inviteCode.trim().toUpperCase(),
            });
            if (rpcError || data === false) {
                setError(lang === 'zh'
                    ? '绑定失败：邀请码无效、已过期或被他人使用。请联系老师。'
                    : 'Linking failed: Invite code is invalid, expired, or already claimed.');
            } else {
                try { localStorage.setItem(REGISTERED_KEY, '1'); } catch { }
                setSuccessMsg(lang === 'zh' ? '✅ 邀请码绑定成功！正在进入...' : '✅ Invite code linked! Entering...');
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred during linking.');
        }
    };

    const title = isRegister
        ? (lang === 'zh' ? '学生注册' : 'Student Registration')
        : (lang === 'zh' ? '学生登录' : 'Student Sign In');

    const subtitle = isRegister
        ? (lang === 'zh' ? '填写老师提供的邀请码和账号信息' : 'Enter your invite code and account details')
        : (lang === 'zh' ? '使用已有账号登录' : 'Sign in with your account');

    return (
        <PageLayout>
            <BodyContainer className="max-w-md mx-auto mt-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="text-center mb-6">
                    <div className={`w-16 h-16 ${isRegister ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        {isRegister ? <KeyRound size={32} /> : <LogIn size={32} />}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h2>
                    <p className="text-slate-500 text-sm mt-2">{subtitle}</p>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-500/20 mb-4">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm rounded-lg border border-emerald-200 dark:border-emerald-500/20 flex items-start gap-2 mb-4">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <div>
                            <label className="text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                                <KeyRound size={12} /> {lang === 'zh' ? '邀请码' : 'Invite Code'}
                            </label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                placeholder={lang === 'zh' ? '6位邀请码 (如: A1B2C3)' : '6-char code (e.g. A1B2C3)'}
                                className="w-full text-center tracking-wider uppercase px-4 py-3 rounded-xl border-2 border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 focus:border-sky-500 outline-none transition-all font-mono font-bold text-slate-800 dark:text-slate-200"
                                maxLength={6}
                                required
                            />
                        </div>
                    )}

                    {isRegister && (
                        <div>
                            <label className="text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                                <User size={12} /> {lang === 'zh' ? '用户名' : 'Username'}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-200"
                                placeholder={lang === 'zh' ? '你的显示名称' : 'Your display name'}
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                            <Mail size={12} /> {lang === 'zh' ? '邮箱' : 'Email'}
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-200"
                            placeholder="student@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1.5 mb-1">
                            <Lock size={12} /> {lang === 'zh' ? '密码' : 'Password'}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-200"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isAuthLoading || loading}
                        className={`w-full py-3.5 mt-2 text-white rounded-xl font-bold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${isRegister ? 'bg-sky-500 hover:bg-sky-600' : 'bg-emerald-500 hover:bg-emerald-600'
                            }`}
                    >
                        {(isAuthLoading || loading) ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : isRegister ? (
                            <><UserPlus size={18} /> {lang === 'zh' ? '注册' : 'Register'}</>
                        ) : (
                            <><LogIn size={18} /> {lang === 'zh' ? '登录' : 'Sign In'}</>
                        )}
                    </button>

                    <div className="text-center text-sm text-slate-500 pt-1">
                        {isRegister ? (
                            <>{lang === 'zh' ? '已有账号？' : 'Already have an account? '}
                                <button type="button" onClick={() => switchMode('login')}
                                    className="text-emerald-600 font-semibold hover:underline">
                                    {lang === 'zh' ? '直接登录' : 'Sign In'}
                                </button>
                            </>
                        ) : (
                            <>{lang === 'zh' ? '第一次使用？' : 'First time here? '}
                                <button type="button" onClick={() => switchMode('register')}
                                    className="text-sky-600 font-semibold hover:underline">
                                    {lang === 'zh' ? '注册新账号' : 'Register'}
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </BodyContainer>
        </PageLayout>
    );
};
