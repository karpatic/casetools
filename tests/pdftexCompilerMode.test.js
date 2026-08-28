import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BROWSER_PDFTEX_DEV_FALLBACK_STORAGE_KEY,
    BROWSER_PDFTEX_STORAGE_KEY,
    selectPacketPdfCompilerMode,
} from '../docs/utils/pdftex/compilerMode.js';

function fakeStorage(entries = {}) {
    return {
        getItem: key => entries[key] ?? null,
    };
}

test('uses the Pandoc server compiler by default', () => {
    assert.deepEqual(
        selectPacketPdfCompilerMode({
            location: { search: '' },
            localStorage: fakeStorage(),
        }),
        {
            compiler: 'pandoc-server',
            source: 'default',
            rawValue: null,
            devPackageFallback: false,
            devPackageFallbackSource: 'default',
        },
    );
});

test('enables browser pdfTeX only through an explicit query value', () => {
    const mode = selectPacketPdfCompilerMode({
        location: { search: '?casetools-pdftex=browser' },
        localStorage: fakeStorage(),
    });

    assert.equal(mode.compiler, 'browser-pdftex');
    assert.equal(mode.source, 'query');
    assert.equal(mode.rawValue, 'browser');
});

test('supports localStorage opt-in but lets a query disable override it', () => {
    const mode = selectPacketPdfCompilerMode({
        location: { search: '?casetools-pdftex=server' },
        localStorage: fakeStorage({ [BROWSER_PDFTEX_STORAGE_KEY]: 'true' }),
    });

    assert.equal(mode.compiler, 'pandoc-server');
    assert.equal(mode.source, 'query');
    assert.equal(mode.rawValue, 'server');
});

test('requires a separate explicit setting for the TeX Live development fallback', () => {
    const mode = selectPacketPdfCompilerMode({
        location: { search: '?casetools-pdftex=1&casetools-pdftex-dev-packages=1' },
        localStorage: fakeStorage({ [BROWSER_PDFTEX_DEV_FALLBACK_STORAGE_KEY]: 'false' }),
    });

    assert.equal(mode.compiler, 'browser-pdftex');
    assert.equal(mode.devPackageFallback, true);
    assert.equal(mode.devPackageFallbackSource, 'query');
});
