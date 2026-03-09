/**
 * Pathway Academy Toolkit — Landing Page Auth
 * Uses Supabase JS SDK (loaded via CDN) for unified authentication.
 * Session persists in localStorage and is auto-shared across all sub-apps.
 * In dev mode, tokens are passed via URL params for cross-port SSO.
 */
(function () {
    const SUPABASE_URL = 'https://mjvxaicypucfrrvollwm.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdnhhaWN5cHVjZnJydm9sbHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTg0MjUsImV4cCI6MjA4ODE3NDQyNX0.uMeRaP7C7fQvKjJlhGrDxGtp0OY6PHMod0FSXOInCzU';

    let supabaseClient = null;
    let currentSession = null;

    /** Dev-mode: map production paths to dev server ports */
    const isDevMode = window.location.hostname === 'localhost' && window.location.port === '3000';
    const DEV_PORT_MAP = {
        '/planner/': 'http://localhost:3001/planner/',
        '/essay-lab/': 'http://localhost:3002/essay-lab/',
        '/nature-compass/': 'http://localhost:3003/nature-compass/',
        '/academy-ops/': 'http://localhost:3005/academy-ops/',
        '/edu-hub/': 'http://localhost:3006/edu-hub/',
        '/student-portal/': 'http://localhost:3007/student-portal/',
    };

    function getClient() {
        if (supabaseClient) return supabaseClient;
        if (typeof supabase === 'undefined' || !supabase.createClient) {
            console.warn('Supabase SDK not loaded');
            return null;
        }
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        return supabaseClient;
    }

    function getLang() {
        try { return localStorage.getItem('pathway_uiLang') || 'en'; } catch { return 'en'; }
    }

    function t(key) {
        const map = {
            'auth.login': { en: 'Sign In', zh: '登录' },
            'auth.signup': { en: 'Sign Up', zh: '注册' },
            'auth.logout': { en: 'Sign Out', zh: '退出' },
            'auth.email': { en: 'Email', zh: '邮箱' },
            'auth.password': { en: 'Password', zh: '密码' },
            'auth.username': { en: 'Username', zh: '用户名' },
            'auth.loginTitle': { en: 'Sign In to Toolkit', zh: '登录工具箱' },
            'auth.signupTitle': { en: 'Create Account', zh: '创建账号' },
            'auth.noAccount': { en: "Don't have an account?", zh: '没有账号？' },
            'auth.hasAccount': { en: 'Already have an account?', zh: '已有账号？' },
            'auth.welcome': { en: 'Welcome', zh: '欢迎' },
            'auth.confirmEmail': { en: 'Check your email to confirm your account', zh: '请查看邮箱确认账号' },
        };
        const lang = getLang();
        return map[key]?.[lang] || map[key]?.en || key;
    }

    // ── UI Rendering ──

    function renderAuthUI() {
        const client = getClient();
        if (!client) return;

        // Check for URL token params (cross-port SSO return)
        const params = new URLSearchParams(window.location.search);
        const token = params.get('_token');
        const refresh = params.get('_refresh');
        if (token && refresh) {
            params.delete('_token');
            params.delete('_refresh');
            const clean = params.toString();
            const newUrl = window.location.pathname + (clean ? '?' + clean : '') + window.location.hash;
            window.history.replaceState(null, '', newUrl);
            client.auth.setSession({ access_token: token, refresh_token: refresh }).then(({ data }) => {
                currentSession = data.session;
                updateHeader(data.session?.user ?? null);
                updateToolLinks();
            });
            return;
        }

        client.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                // Invalid refresh token — clear stale session
                console.warn('Stale session detected, clearing:', error.message);
                client.auth.signOut().catch(() => { });
                currentSession = null;
            } else {
                currentSession = session;
            }
            updateHeader(currentSession?.user ?? null);
            updateToolLinks();
        }).catch(() => {
            currentSession = null;
            updateHeader(null);
            updateToolLinks();
        });

        client.auth.onAuthStateChange((_event, session) => {
            currentSession = session;
            updateHeader(session?.user ?? null);
            updateToolLinks();
        });
    }

    function getDisplayName(user) {
        if (!user) return '';
        return user.user_metadata?.display_name || user.email?.split('@')[0] || '';
    }

    function updateHeader(user) {
        const container = document.getElementById('auth-container');
        if (!container) return;

        if (user) {
            const name = getDisplayName(user);
            const initial = (name[0] || '?').toUpperCase();
            container.innerHTML = `
                <div class="auth-user">
                    <div class="auth-avatar">${initial}</div>
                    <span class="auth-email">${name}</span>
                    <button class="auth-btn auth-btn-outline" onclick="pathwayAuth.signOut()">${t('auth.logout')}</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <button class="auth-btn auth-btn-primary" onclick="pathwayAuth.showModal('login')">${t('auth.login')}</button>
            `;
        }
    }

    /** Rewrite links for dev mode and append auth tokens, lock/unlock cards */
    function updateToolLinks() {
        const isLoggedIn = !!currentSession?.access_token;
        const lang = getLang();

        document.querySelectorAll('.tool-card').forEach(card => {
            const link = card.querySelector('a.btn');
            if (!link) return;

            let href = link.getAttribute('data-original-href') || link.getAttribute('href');
            if (!href || href === '#') href = link.getAttribute('data-original-href');
            if (!href) return;

            // Store originals on first run
            if (!link.getAttribute('data-original-href')) {
                link.setAttribute('data-original-href', href);
            }
            if (!link.getAttribute('data-original-i18n') && link.getAttribute('data-i18n')) {
                link.setAttribute('data-original-i18n', link.getAttribute('data-i18n'));
            }

            if (isLoggedIn) {
                // Unlock card
                card.classList.remove('locked');
                link.onclick = null;

                // Restore href from original
                href = link.getAttribute('data-original-href');

                // Dev mode: map to dev server ports
                if (isDevMode && DEV_PORT_MAP[href]) {
                    href = DEV_PORT_MAP[href];
                }

                // Append auth tokens
                const sep = href.includes('?') ? '&' : '?';
                href = `${href}${sep}_token=${currentSession.access_token}&_refresh=${currentSession.refresh_token}`;

                link.setAttribute('href', href);
                link.setAttribute('target', '_blank');

                // Restore i18n key and reapply translations
                const origI18n = link.getAttribute('data-original-i18n');
                if (origI18n) {
                    link.setAttribute('data-i18n', origI18n);
                }
                if (typeof pathwayI18n !== 'undefined') {
                    pathwayI18n.apply(lang);
                }
            } else {
                // Lock card
                card.classList.add('locked');
                link.setAttribute('href', '#');
                link.removeAttribute('target');
                // Remove data-i18n so i18n system won't overwrite our lock text
                if (link.getAttribute('data-i18n')) {
                    if (!link.getAttribute('data-original-i18n')) {
                        link.setAttribute('data-original-i18n', link.getAttribute('data-i18n'));
                    }
                    link.removeAttribute('data-i18n');
                }
                link.textContent = lang === 'zh' ? '🔒 登录后访问' : '🔒 Sign In to Access';
                link.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showModal('login');
                };
            }
        });
    }

    function showModal(mode) {
        const existing = document.getElementById('auth-modal');
        if (existing) existing.remove();

        const isLogin = mode === 'login';

        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal-overlay';
        modal.innerHTML = `
            <div class="auth-modal">
                <button class="auth-modal-close" onclick="pathwayAuth.closeModal()">✕</button>
                <div class="auth-modal-icon">🎓</div>
                <h2 class="auth-modal-title">${isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}</h2>
                <div id="auth-error" class="auth-error" style="display:none"></div>
                <div id="auth-success" class="auth-success" style="display:none"></div>
                <form id="auth-form" class="auth-form" onsubmit="return false;">
                    ${!isLogin ? `
                        <label class="auth-label">${t('auth.username')}</label>
                        <input id="auth-username" type="text" class="auth-input" required placeholder="${getLang() === 'zh' ? '显示名称' : 'Display name'}" autocomplete="name" />
                    ` : ''}
                    <label class="auth-label">${t('auth.email')}</label>
                    <input id="auth-email" type="email" class="auth-input" required autocomplete="email" />
                    <label class="auth-label">${t('auth.password')}</label>
                    <input id="auth-password" type="password" class="auth-input" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
                    <button type="submit" id="auth-submit" class="auth-btn auth-btn-primary auth-btn-full">
                        ${isLogin ? t('auth.login') : t('auth.signup')}
                    </button>
                </form>
                <div class="auth-switch">
                    ${isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
                    <a href="#" onclick="pathwayAuth.showModal('${isLogin ? 'signup' : 'login'}'); return false;">
                        ${isLogin ? t('auth.signup') : t('auth.login')}
                    </a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        requestAnimationFrame(() => modal.classList.add('visible'));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.getElementById('auth-form').addEventListener('submit', () => {
            isLogin ? handleSignIn() : handleSignUp();
        });

        setTimeout(() => {
            const firstInput = document.getElementById(isLogin ? 'auth-email' : 'auth-username');
            firstInput?.focus();
        }, 100);
    }

    function closeModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 200);
        }
    }

    async function handleSignIn() {
        const client = getClient();
        if (!client) return;

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');
        const submitBtn = document.getElementById('auth-submit');

        submitBtn.disabled = true;
        submitBtn.textContent = '...';
        errorEl.style.display = 'none';

        const { error } = await client.auth.signInWithPassword({ email, password });

        if (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = t('auth.login');
        } else {
            closeModal();
        }
    }

    async function handleSignUp() {
        const client = getClient();
        if (!client) return;

        const username = document.getElementById('auth-username')?.value?.trim();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');
        const successEl = document.getElementById('auth-success');
        const submitBtn = document.getElementById('auth-submit');

        if (!username) {
            errorEl.textContent = getLang() === 'zh' ? '请输入用户名' : 'Username is required';
            errorEl.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '...';
        errorEl.style.display = 'none';

        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: { data: { display_name: username } },
        });

        if (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = t('auth.signup');
        } else if (data.session) {
            closeModal();
        } else {
            successEl.textContent = t('auth.confirmEmail');
            successEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = t('auth.signup');
        }
    }

    async function signOutUser() {
        const client = getClient();
        if (!client) return;
        await client.auth.signOut({ scope: 'global' });
        currentSession = null;
        // Remove tokens from tool links
        document.querySelectorAll('.tool-card a.btn').forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                link.setAttribute('href', href.replace(/[?&]_token=[^&]*/, '').replace(/[?&]_refresh=[^&]*/, ''));
            }
        });
    }

    // ── Expose API ──
    window.pathwayAuth = {
        init: renderAuthUI,
        showModal: showModal,
        closeModal: closeModal,
        signOut: signOutUser,
    };

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderAuthUI);
    } else {
        renderAuthUI();
    }
})();
