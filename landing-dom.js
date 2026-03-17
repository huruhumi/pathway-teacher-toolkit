(function () {
    function ensureToolLinkMeta(link) {
        if (!link) {
            return { originalHref: '', originalI18n: '', originalText: '' };
        }

        const currentHref = link.getAttribute('href') || '';
        const originalHref = link.getAttribute('data-original-href') || currentHref;
        if (originalHref) {
            link.setAttribute('data-original-href', originalHref);
        }

        const currentI18n = link.getAttribute('data-i18n') || '';
        if (currentI18n && !link.getAttribute('data-original-i18n')) {
            link.setAttribute('data-original-i18n', currentI18n);
        }

        if (!link.getAttribute('data-original-text')) {
            link.setAttribute('data-original-text', link.textContent || '');
        }

        return {
            originalHref,
            originalI18n: link.getAttribute('data-original-i18n') || '',
            originalText: link.getAttribute('data-original-text') || '',
        };
    }

    function setToolLinkUnlocked(link, href, i18nKey) {
        if (!link) return;
        link.onclick = null;
        link.setAttribute('target', '_blank');
        link.setAttribute('href', href);
        if (i18nKey) {
            link.setAttribute('data-i18n', i18nKey);
        }
    }

    function createLockIcon() {
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
    }

    function setToolLinkLocked(link, text, onClick) {
        if (!link) return;
        link.setAttribute('href', '#');
        link.removeAttribute('target');
        link.removeAttribute('data-i18n');
        link.textContent = '';
        link.append(createLockIcon(), document.createTextNode(text));
        link.onclick = function (event) {
            event.preventDefault();
            event.stopPropagation();
            onClick?.(event);
        };
    }

    window.pathwayLandingDom = {
        ensureToolLinkMeta,
        setToolLinkUnlocked,
        setToolLinkLocked,
    };
})();
