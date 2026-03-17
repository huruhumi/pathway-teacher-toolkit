(function () {
    const LANG_STORAGE_KEY = 'pathway_uiLang';
    const REGISTRY_ENDPOINTS = ['/app-registry.json', '/packages/config/app-registry.json'];
    const COPY_SECTIONS = ['authTranslations', 'staticTranslations', 'toolTranslations', 'appIconMeta'];
    const isDevLanding = window.location.hostname === 'localhost' && window.location.port === '3000';

    let registryPromise = null;

    function isRecord(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function logWarnings(scope, warnings) {
        if (!warnings.length) return;
        console.warn(`[landing-runtime] ${scope}: ${warnings.join(' ')}`);
    }

    function validateLandingCopy(copy) {
        const warnings = [];
        if (!isRecord(copy)) {
            warnings.push('window.pathwayLandingCopy is missing or invalid.');
            return warnings;
        }

        for (const section of COPY_SECTIONS) {
            if (!isRecord(copy[section])) {
                warnings.push(`"${section}" should be an object.`);
            }
        }

        return warnings;
    }

    function validateRegistryPayload(payload) {
        if (!Array.isArray(payload)) {
            return { apps: [], warnings: ['Registry payload should be an array.'] };
        }

        let invalidEntries = 0;
        const apps = payload.filter((item) => {
            const valid =
                isRecord(item) &&
                typeof item.id === 'string' &&
                typeof item.scanPath === 'string' &&
                (typeof item.devPort === 'number' || typeof item.devPort === 'string');

            if (!valid) {
                invalidEntries += 1;
            }
            return valid;
        });

        const warnings = [];
        if (invalidEntries > 0) {
            warnings.push(`${invalidEntries} invalid app entries were ignored.`);
        }

        return { apps, warnings };
    }

    function runSanityChecks() {
        logWarnings('Landing copy validation', validateLandingCopy(window.pathwayLandingCopy));
    }

    async function loadAppRegistry() {
        if (registryPromise) return registryPromise;

        registryPromise = (async () => {
            for (const endpoint of REGISTRY_ENDPOINTS) {
                try {
                    const response = await fetch(endpoint, { cache: 'no-store' });
                    if (!response.ok) continue;

                    const payload = await response.json();
                    if (Array.isArray(payload)) {
                        const { apps, warnings } = validateRegistryPayload(payload);
                        logWarnings(`Registry validation (${endpoint})`, warnings);
                        if (apps.length || payload.length === 0) {
                            return apps;
                        }
                    }
                } catch {
                    // try next endpoint
                }
            }

            console.error('[landing-runtime] Unable to load app registry.');
            return [];
        })();

        return registryPromise;
    }

    function getLang() {
        try {
            return localStorage.getItem(LANG_STORAGE_KEY) || 'en';
        } catch {
            return 'en';
        }
    }

    function setLang(lang) {
        try {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch {
            // no-op
        }
    }

    window.pathwayLandingRuntime = {
        isDevLanding,
        loadAppRegistry,
        getLang,
        setLang,
        validateLandingCopy,
        validateRegistryPayload,
        runSanityChecks,
    };

    runSanityChecks();
})();
