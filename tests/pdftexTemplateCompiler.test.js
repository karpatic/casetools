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

test('uses the Pandoc server compiler by default', async () => {
    const fetchImpl = fakeFetch();
    let browserCalls = 0;
    const compiler = createTemplatePdfCompiler({
        fetchImpl,
        pandocUrl: 'https://pandoc.example/pdf',
        environment: { location: { search: '' }, localStorage: null },
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

test('logs the real browser pdfTeX failure and falls back to the server for the rest of the packet', async () => {
    const fetchImpl = fakeFetch();
    const errors = [];
    let browserCalls = 0;
    const compiler = createTemplatePdfCompiler({
        fetchImpl,
        pandocUrl: 'https://pandoc.example/pdf',
        environment: { location: { search: '?casetools-pdftex=1' }, localStorage: null },
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

    const first = await compiler.compile({
        templatePath: 'rsc/latex/certificate.tex',
        pandocText: '---first---',
        templateData: { name: 'Fallback' },
    });
    const second = await compiler.compile({
        templatePath: 'rsc/latex/cover.tex',
        pandocText: '---second---',
        templateData: { name: 'Fallback' },
    });

    assert.equal(await first.text(), '%PDF-server');
    assert.equal(await second.text(), '%PDF-server');
    assert.equal(browserCalls, 1);
    assert.equal(errors.length, 1);
    assert.match(JSON.stringify(errors[0]), /newtxtext\.sty/);
    assert.match(JSON.stringify(errors[0]), /pdfTeX status 1/);
});
