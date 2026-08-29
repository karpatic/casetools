import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BROWSER_PDFTEX_DEV_FALLBACK_STORAGE_KEY,
    selectPacketPdfCompilerMode,
} from '../docs/utils/pdftex/compilerMode.js';

function fakeStorage(entries = {}) {
    return {
        getItem: key => entries[key] ?? null,
    };
}

test('uses browser pdfTeX by default', () => {
    assert.deepEqual(
        selectPacketPdfCompilerMode({
            location: { search: '' },
            localStorage: fakeStorage(),
        }),
        {
            compiler: 'browser-pdftex',
            source: 'default',
            rawValue: null,
            devPackageFallback: false,
            devPackageFallbackSource: 'default',
        },
    );
});

test('keeps browser pdfTeX enabled through an explicit query value', () => {
    const mode = selectPacketPdfCompilerMode({
        location: { search: '?casetools-pdftex=browser' },
        localStorage: fakeStorage(),
    });

    assert.equal(mode.compiler, 'browser-pdftex');
    assert.equal(mode.source, 'query');
    assert.equal(mode.rawValue, 'browser');
});

test('keeps an explicit Pandoc server emergency query mode', () => {
    const mode = selectPacketPdfCompilerMode({
        location: { search: '?pdftex=pandoc' },
        localStorage: fakeStorage(),
    });

    assert.equal(mode.compiler, 'pandoc-server');
    assert.equal(mode.source, 'query');
    assert.equal(mode.rawValue, 'pandoc');
});

test('keeps the compiler emergency mode tied to the explicit query', () => {
    const mode = selectPacketPdfCompilerMode({
        location: { search: '' },
        localStorage: fakeStorage({ 'casetools.experimentalBrowserPdfTeX': 'pandoc' }),
    });

    assert.equal(mode.compiler, 'browser-pdftex');
    assert.equal(mode.source, 'default');
});

test('requires a separate explicit setting for the TeX Live development fallback', () => {
    const mode = selectPacketPdfCompilerMode({
        location: { search: '?casetools-pdftex-dev-packages=1' },
        localStorage: fakeStorage({ [BROWSER_PDFTEX_DEV_FALLBACK_STORAGE_KEY]: 'false' }),
    });

    assert.equal(mode.compiler, 'browser-pdftex');
    assert.equal(mode.devPackageFallback, true);
    assert.equal(mode.devPackageFallbackSource, 'query');
});
