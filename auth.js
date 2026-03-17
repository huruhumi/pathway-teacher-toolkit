(function () {
    const SUPABASE_URL = 'https://mjvxaicypucfrrvollwm.supabase.co';
    const SUPABASE_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qdnhhaWN5cHVjZnJydm9sbHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTg0MjUsImV4cCI6MjA4ODE3NDQyNX0.uMeRaP7C7fQvKjJlhGrDxGtp0OY6PHMod0FSXOInCzU';
    const runtime = window.pathwayLandingRuntime;
    const domHelper = window.pathwayLandingDom || {
        ensureToolLinkMeta(link) {
            return {
                originalHref: link.getAttribute('data-original-href') || link.getAttribute('href') || '',
                originalI18n: link.getAttribute('data-original-i18n') || link.getAttribute('data-i18n') || '',
                originalText: link.getAttribute('data-original-text') || link.textContent || '',
            };
        },
        setToolLinkUnlocked(link, href, i18nKey) {
            link.onclick = null;
            link.setAttribute('target', '_blank');
            link.setAttribute('href', href);
            if (i18nKey) {
                link.setAttribute('data-i18n', i18nKey);
            }
        },
        createLockIcon() {
            const icon = document.createElement('span');
            icon.className = 'lock-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            `;
            return icon;
        },
        setToolLinkLocked(link, text, onClick) {
            link.setAttribute('href', '#');
            link.removeAttribute('target');
            link.removeAttribute('data-i18n');
            link.textContent = '';
            link.append(this.createLockIcon(), document.createTextNode(text));
            link.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();
                onClick?.(event);
            };
        },
    };

    let supabaseClient = null;
    let currentSession = null;
    let registryByPath = new Map();

    function t(key) {
        return resolveI18nText(key) || key;
    }

    function getClient() {
        if (supabaseClient) return supabaseClient;
        if (typeof supabase === 'undefined' || !supabase.createClient) {
            console.warn('[landing-auth] Supabase SDK not loaded');
            return null;
        }

        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        return supabaseClient;
    }

    function getDisplayName(user) {
        if (!user) return '';
        return user.user_metadata?.display_name || user.email?.split('@')[0] || '';
    }

    function resolveI18nText(i18nKey) {
        if (!i18nKey) return '';
        const translated = window.pathwayI18n?.resolve?.(i18nKey) || '';
        if (!translated || translated === i18nKey) return '';
        return translated;
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

    function resolveTargetHref(originalHref) {
        if (!runtime?.isDevLanding) return originalHref;
        const app = registryByPath.get(originalHref);
        if (!app) return originalHref;
        return `http://localhost:${app.devPort}${app.scanPath}`;
    }

    function withSessionTokens(href) {
        if (!currentSession?.access_token || !currentSession?.refresh_token) return href;
        const separator = href.includes('?') ? '&' : '?';
        return `${href}${separator}_token=${currentSession.access_token}&_refresh=${currentSession.refresh_token}`;
    }

    function updateToolLinks() {
        const isLoggedIn = Boolean(currentSession?.access_token);

        document.querySelectorAll('.tool-card').forEach((card) => {
            const link = card.querySelector('a.btn');
            if (!link) return;

            const meta = domHelper.ensureToolLinkMeta(link);
            if (!meta.originalHref) return;

            if (isLoggedIn) {
                card.classList.remove('locked');
                const targetHref = withSessionTokens(resolveTargetHref(meta.originalHref));
                domHelper.setToolLinkUnlocked(link, targetHref, meta.originalI18n);

                if (meta.originalI18n) {
                    const translatedText = resolveI18nText(meta.originalI18n);
                    if (translatedText) {
                        link.textContent = translatedText;
                    } else if (meta.originalText) {
                        link.textContent = meta.originalText;
                    }
                } else if (meta.originalText) {
                    link.textContent = meta.originalText;
                }
            } else {
                card.classList.add('locked');
                const lockedText = t('auth.lockedCta');
                domHelper.setToolLinkLocked(link, lockedText, () => showModal('login'));
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
                <button class="auth-modal-close" onclick="pathwayAuth.closeModal()">x</button>
                <div class="auth-modal-icon">PA</div>
                <h2 class="auth-modal-title">${isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}</h2>
                <div id="auth-error" class="auth-error" style="display:none"></div>
                <div id="auth-success" class="auth-success" style="display:none"></div>
                <form id="auth-form" class="auth-form" onsubmit="return false;">
                    ${
                        !isLogin
                            ? `
                        <label class="auth-label">${t('auth.username')}</label>
                        <input id="auth-username" type="text" class="auth-input" required placeholder="${t(
                            'auth.displayNamePlaceholder'
                        )}" autocomplete="name" />
                    `
                            : ''
                    }
                    <label class="auth-label">${t('auth.email')}</label>
                    <input id="auth-email" type="email" class="auth-input" required autocomplete="email" />
                    <label class="auth-label">${t('auth.password')}</label>
                    <input id="auth-password" type="password" class="auth-input" required minlength="6" autocomplete="${
                        isLogin ? 'current-password' : 'new-password'
                    }" />
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

        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });

        document.getElementById('auth-form').addEventListener('submit', () => {
            if (isLogin) {
                handleSignIn();
            } else {
                handleSignUp();
            }
        });

        setTimeout(() => {
            const firstInput = document.getElementById(isLogin ? 'auth-email' : 'auth-username');
            firstInput?.focus();
        }, 100);
    }

    function closeModal() {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 200);
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
            return;
        }

        closeModal();
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
            errorEl.textContent = t('auth.usernameRequired');
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
            return;
        }

        if (data.session) {
            closeModal();
            return;
        }

        successEl.textContent = t('auth.confirmEmail');
        successEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.signup');
    }

    async function signOutUser() {
        const client = getClient();
        if (!client) return;
        await client.auth.signOut({ scope: 'global' });
        currentSession = null;
        updateHeader(null);
        updateToolLinks();
    }

    function renderAuthUI() {
        const client = getClient();
        if (!client) return;

        const params = new URLSearchParams(window.location.search);
        const token = params.get('_token');
        const refresh = params.get('_refresh');
        if (token && refresh) {
            params.delete('_token');
            params.delete('_refresh');
            const clean = params.toString();
            const nextUrl = `${window.location.pathname}${clean ? `?${clean}` : ''}${window.location.hash}`;
            window.history.replaceState(null, '', nextUrl);

            client.auth
                .setSession({ access_token: token, refresh_token: refresh })
                .then(({ data }) => {
                    currentSession = data.session;
                    updateHeader(data.session?.user ?? null);
                    updateToolLinks();
                })
                .catch(() => {
                    updateHeader(null);
                    updateToolLinks();
                });
            return;
        }

        client.auth
            .getSession()
            .then(({ data: { session }, error }) => {
                if (error) {
                    console.warn('[landing-auth] Stale session detected:', error.message);
                    client.auth.signOut().catch(() => {});
                    currentSession = null;
                } else {
                    currentSession = session;
                }
                updateHeader(currentSession?.user ?? null);
                updateToolLinks();
            })
            .catch(() => {
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

    window.pathwayAuth = {
        init: renderAuthUI,
        showModal,
        closeModal,
        signOut: signOutUser,
    };

    async function init() {
        const registry = (await runtime?.loadAppRegistry?.()) || [];
        registryByPath = new Map(registry.map((app) => [app.scanPath, app]));
        renderAuthUI();
        window.addEventListener('pathway:tools-rendered', updateToolLinks);
        window.addEventListener('pathway:language-changed', updateToolLinks);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
