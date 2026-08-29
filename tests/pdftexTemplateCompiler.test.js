import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BrowserPdfTeXCompileError,
    createTemplatePdfCompiler,
    pdfBytesToBlob,
} from '../docs/utils/pdftex/templatePdfCompiler.js';

function pdfBlob(label = 'server') {
    return new Blob([`%PDF-${label}`], { type: 'application/pdf' });
}

function fakeFetch({ template = 'Hello $name$', serverBlob = pdfBlob() } = {}) {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        calls.push({ url, options });
        if (String(url).endsWith('.tex')) {
            return {
                ok: true,
                text: async () => template,
            };
        }
        return {
            ok: true,
            blob: async () => serverBlob,
        };
    };
    fetchImpl.calls = calls;
    return fetchImpl;
}

test('converts valid pdfTeX bytes to the packet Blob contract', async () => {
    const blob = pdfBytesToBlob(new TextEncoder().encode('%PDF-browser'));

    assert.equal(blob.type, 'application/pdf');
    assert.equal(await blob.text(), '%PDF-browser');
});

test('rejects malformed pdfTeX bytes before creating a packet Blob', () => {
    assert.throws(
        () => pdfBytesToBlob(new TextEncoder().encode('not-a-pdf')),
        /Browser pdfTeX returned malformed PDF bytes/,
    );
});

test('uses browser pdfTeX by default', async () => {
    const fetchImpl = fakeFetch();
    let browserCalls = 0;
    const compiler = createTemplatePdfCompiler({
        fetchImpl,
        pandocUrl: 'https://pandoc.example/pdf',
        environment: { location: { search: '' }, localStorage: null },
        browserCompileLatex: async (latex, options) => {
            browserCalls += 1;
            assert.equal(latex, 'Hello Browser');
            assert.equal(options.devPackageFallback, false);
            return pdfBlob('browser');
        },
    });

    const result = await compiler.compile({
        templatePath: 'rsc/latex/certificate.tex',
        pandocText: '---\nname: Server\n---',
        templateData: { name: 'Browser' },
    });

    assert.equal(result.type, 'application/pdf');
    assert.equal(await result.text(), '%PDF-browser');
    assert.equal(browserCalls, 1);
    assert.equal(fetchImpl.calls.length, 1);
    assert.equal(fetchImpl.calls[0].url, 'rsc/latex/certificate.tex');
});

test('uses the Pandoc server only through explicit emergency mode', async () => {
    const fetchImpl = fakeFetch();
    let browserCalls = 0;
    const compiler = createTemplatePdfCompiler({
        fetchImpl,
        pandocUrl: 'https://pandoc.example/pdf',
        environment: { location: { search: '?pdftex=pandoc' }, localStorage: null },
        browserCompileLatex: async () => {
            browserCalls += 1;
            return pdfBlob('browser');
        },
    });

    const result = await compiler.compile({
        templatePath: 'rsc/latex/certificate.tex',
        pandocText: '---\nname: Server\n---',
        templateData: { name: 'Browser' },
    });

    assert.equal(result.type, 'application/pdf');
    assert.equal(await result.text(), '%PDF-server');
    assert.equal(browserCalls, 0);
    assert.equal(fetchImpl.calls[1].url, 'https://pandoc.example/pdf');
    assert.deepEqual(JSON.parse(fetchImpl.calls[1].options.body), {
        text: '---\nname: Server\n---',
        latex: 'Hello $name$',
    });
});

test('logs the real browser pdfTeX failure and rejects without server fallback', async () => {
    const fetchImpl = fakeFetch();
    const errors = [];
    const events = [];
    const windowTarget = {
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
        dispatchEvent(event) {
            events.push(event);
        },
    };
    let browserCalls = 0;
    const compiler = createTemplatePdfCompiler({
        fetchImpl,
        pandocUrl: 'https://pandoc.example/pdf',
        environment: { location: { search: '' }, localStorage: null, window: windowTarget },
        logger: { error: (...args) => errors.push(args), warn: () => {}, info: () => {} },
        browserCompileLatex: async () => {
            browserCalls += 1;
            throw new BrowserPdfTeXCompileError('pdfTeX status 1', {
                status: 1,
                log: '! LaTeX Error: File `newtxtext.sty` not found.',
                missingFiles: ['newtxtext.sty'],
            });
        },
    });

    await assert.rejects(
        () => compiler.compile({
            templatePath: 'rsc/latex/certificate.tex',
            pandocText: '---first---',
            templateData: { name: 'Failure' },
        }),
        /pdfTeX status 1/,
    );

    assert.equal(browserCalls, 1);
    assert.equal(fetchImpl.calls.length, 1);
    assert.equal(fetchImpl.calls[0].url, 'rsc/latex/certificate.tex');
    assert.equal(errors.length, 1);
    assert.match(JSON.stringify(errors[0]), /newtxtext\.sty/);
    assert.match(JSON.stringify(errors[0]), /pdfTeX status 1/);
    assert.equal(windowTarget.__casetoolsLastBrowserPdfTeXError.templatePath, 'rsc/latex/certificate.tex');
    assert.deepEqual(windowTarget.__casetoolsLastBrowserPdfTeXError.missingFiles, ['newtxtext.sty']);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'casetools:pdftex-error');
});
