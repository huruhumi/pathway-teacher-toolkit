(function () {
    const runtime = window.pathwayLandingRuntime;

    let appRegistry = [];

    const landingCopy = window.pathwayLandingCopy || {};
    const staticTranslations = landingCopy.staticTranslations || {};
    const authTranslations = landingCopy.authTranslations || {};
    const toolTranslations = landingCopy.toolTranslations || {};
    const appIconMeta = landingCopy.appIconMeta || {};

    function getLang() {
        if (runtime?.getLang) return runtime.getLang();
        try {
            return localStorage.getItem('pathway_uiLang') || 'en';
        } catch {
            return 'en';
        }
    }

    function setLang(lang) {
        if (runtime?.setLang) {
            runtime.setLang(lang);
            return;
        }
        try {
            localStorage.setItem('pathway_uiLang', lang);
        } catch {
            // no-op
        }
    }

    function getToolTranslation(appId, field, lang) {
        const appCopy = toolTranslations[appId];
        if (!appCopy || !appCopy[field]) return '';
        return appCopy[field][lang] || appCopy[field].en || '';
    }

    function resolveTranslation(key, lang) {
        if (staticTranslations[key]) {
            return staticTranslations[key][lang] || staticTranslations[key].en;
        }
        if (authTranslations[key]) {
            return authTranslations[key][lang] || authTranslations[key].en;
        }

        if (!key.startsWith('tool.')) return key;

        const [, appId, field] = key.split('.');
        return getToolTranslation(appId, field, lang) || key;
    }

    function getAppHref(app) {
        if (runtime?.isDevLanding) {
            return `http://localhost:${app.devPort}${app.scanPath}`;
        }
        return app.scanPath;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function renderToolCards(lang) {
        const container = document.getElementById('tools-container');
        if (!container) return;

        if (!appRegistry.length) {
            container.innerHTML = '';
            return;
        }

        const cards = appRegistry
            .map((app) => {
                const iconMeta = appIconMeta[app.id] || { className: 'planner-icon', glyph: 'APP' };
                const titleKey = `tool.${app.id}.title`;
                const descKey = `tool.${app.id}.desc`;
                const btnKey = `tool.${app.id}.btn`;
                const href = getAppHref(app);

                return `
                    <article class="tool-card">
                        <div class="tool-icon-wrapper">
                            <div class="tool-icon ${iconMeta.className}">${escapeHtml(iconMeta.glyph)}</div>
                        </div>
                        <h3 data-i18n="${titleKey}">${escapeHtml(resolveTranslation(titleKey, lang))}</h3>
                        <p data-i18n="${descKey}">${escapeHtml(resolveTranslation(descKey, lang))}</p>
                        <div class="card-footer">
                            <a
                                href="${escapeHtml(href)}"
                                data-original-href="${escapeHtml(href)}"
                                target="_blank"
                                class="btn btn-outline"
                                data-i18n="${btnKey}"
                            >${escapeHtml(resolveTranslation(btnKey, lang))}</a>
                        </div>
                    </article>
                `;
            })
            .join('');

        container.innerHTML = cards;
        window.dispatchEvent(new CustomEvent('pathway:tools-rendered'));
    }

    function applyTranslations(lang) {
        renderToolCards(lang);

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            el.textContent = resolveTranslation(key, lang);
        });

        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

        const toggleBtn = document.getElementById('lang-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = lang === 'en' ? '\u4e2d\u6587' : 'EN';
            toggleBtn.setAttribute('data-current-lang', lang);
        }

        window.dispatchEvent(new CustomEvent('pathway:language-changed', { detail: { lang } }));
    }

    function toggleLanguage() {
        const next = getLang() === 'en' ? 'zh' : 'en';
        setLang(next);
        applyTranslations(next);
    }

    window.pathwayI18n = {
        toggle: toggleLanguage,
        apply: applyTranslations,
        getLang,
        resolve(key, lang) {
            return resolveTranslation(key, lang || getLang());
        },
    };

    async function init() {
        appRegistry = (await runtime?.loadAppRegistry?.()) || [];
        applyTranslations(getLang());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
