const BROWSER_PDFTEX_DEV_FALLBACK_STORAGE_KEY = 'casetools.experimentalBrowserPdfTeX.devPackageFallback';

const BROWSER_PDFTEX_QUERY_KEYS = [
    'casetools-pdftex',
    'casetoolsPdfTeX',
    'pdftex',
];

const BROWSER_PDFTEX_DEV_FALLBACK_QUERY_KEYS = [
    'casetools-pdftex-dev-packages',
    'casetoolsPdfTeXDevPackages',
    'pdftexDevPackages',
];

const ENABLE_VALUES = new Set(['1', 'true', 'on', 'yes', 'browser', 'pdftex', 'browser-pdftex']);
const DISABLE_VALUES = new Set(['0', 'false', 'off', 'no', 'server', 'pandoc', 'pandoc-server']);

function selectPacketPdfCompilerMode(environment = {}) {
    const location = environment.location ?? globalThis?.location;
    const localStorage = environment.localStorage ?? globalThis?.localStorage;
    const compilerPreference = readPreference({
        queryKeys: BROWSER_PDFTEX_QUERY_KEYS,
        location,
        defaultEnabled: true,
    });
    const devFallbackPreference = readPreference({
        queryKeys: BROWSER_PDFTEX_DEV_FALLBACK_QUERY_KEYS,
        storageKey: BROWSER_PDFTEX_DEV_FALLBACK_STORAGE_KEY,
        location,
        localStorage,
    });

    return {
        compiler: compilerPreference.enabled ? 'browser-pdftex' : 'pandoc-server',
        source: compilerPreference.source,
        rawValue: compilerPreference.rawValue,
        devPackageFallback: devFallbackPreference.enabled,
        devPackageFallbackSource: devFallbackPreference.source,
    };
}

function readPreference({ queryKeys, storageKey, location, localStorage, defaultEnabled = false }) {
    const queryValue = getQueryValue(queryKeys, location);
    if (queryValue !== null) {
        return parsePreferenceValue(queryValue, 'query', defaultEnabled);
    }

    const storageValue = storageKey ? getStorageValue(storageKey, localStorage) : null;
    if (storageValue !== null) {
        return parsePreferenceValue(storageValue, 'localStorage', defaultEnabled);
    }

    return {
        enabled: defaultEnabled,
        source: 'default',
        rawValue: null,
    };
}

function parsePreferenceValue(value, source, defaultEnabled = false) {
    const normalized = String(value).trim().toLowerCase();
    let enabled = defaultEnabled;
    if (ENABLE_VALUES.has(normalized)) enabled = true;
    if (DISABLE_VALUES.has(normalized)) enabled = false;

    return {
        enabled,
        source,
        rawValue: value,
    };
}

function getQueryValue(keys, location) {
    const search = location?.search || '';
    if (!search) return null;
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    for (const key of keys) {
        if (params.has(key)) return params.get(key);
    }
    return null;
}

function getStorageValue(key, localStorage) {
    if (!localStorage) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export {
    BROWSER_PDFTEX_DEV_FALLBACK_STORAGE_KEY,
    selectPacketPdfCompilerMode,
};
