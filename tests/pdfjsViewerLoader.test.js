import test from 'node:test';
import assert from 'node:assert/strict';

import {
    rewritePdfjsViewerHtml,
    rewritePdfjsViewerScript,
} from '../docs/utils/pdf/pdfjsViewerLoader.js';

const urls = {
    pdfjsWebUrl: 'https://mozilla.github.io/pdf.js/web/',
    pdfjsBuildUrl: 'https://mozilla.github.io/pdf.js/build/',
    viewerScriptUrl: 'blob:https://case.example/viewer-script',
    bridgeUrl: 'https://case.example/utils/pdf/pdfjsCaseViewerBridge.js',
};

test('rewrites PDF.js viewer HTML and removes the upstream CSP meta tag', () => {
    const viewerHtml = `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'"
    >
    <meta name="viewport" content="width=device-width">
    <link rel="resource" type="application/l10n" href="locale/locale.json">
    <script type="module" src="../build/pdf.mjs"></script>
    <link rel="stylesheet" href="viewer.css">
</head>
<body>
    <script type="module" src="viewer.mjs"></script>
</body>
</html>`;

    const rewrittenHtml = rewritePdfjsViewerHtml(viewerHtml, urls);

    assert.equal(/content-security-policy/i.test(rewrittenHtml), false);
    assert.match(rewrittenHtml, /<meta charset="utf-8">/);
    assert.match(rewrittenHtml, /href="https:\/\/mozilla\.github\.io\/pdf\.js\/web\/locale\/locale\.json"/);
    assert.match(rewrittenHtml, /src="https:\/\/mozilla\.github\.io\/pdf\.js\/build\/pdf\.mjs"/);
    assert.match(rewrittenHtml, /href="https:\/\/mozilla\.github\.io\/pdf\.js\/web\/viewer\.css"/);
    assert.match(rewrittenHtml, /src="blob:https:\/\/case\.example\/viewer-script"/);
    assert.match(rewrittenHtml, /<script src="https:\/\/case\.example\/utils\/pdf\/pdfjsCaseViewerBridge\.js"><\/script><\/body>/);
    assert.equal(rewrittenHtml.includes('src="viewer.mjs"'), false);
    assert.equal(rewrittenHtml.includes('src="../build/pdf.mjs"'), false);
});

test('viewer HTML rewrite errors identify a missing upstream CSP meta tag', () => {
    const viewerHtml = `<!doctype html>
<html>
<head>
    <link rel="resource" type="application/l10n" href="locale/locale.json">
    <script type="module" src="../build/pdf.mjs"></script>
    <link rel="stylesheet" href="viewer.css">
    <script type="module" src="viewer.mjs"></script>
</head>
<body></body>
</html>`;

    assert.throws(
        () => rewritePdfjsViewerHtml(viewerHtml, urls),
        (error) => {
            assert.match(error.message, /PDF\.js viewer HTML rewrite failed/);
            assert.match(error.message, /content security policy meta tag/i);
            assert.match(error.message, /Expected exactly one upstream Content-Security-Policy meta tag, found 0/);
            return true;
        },
    );
});

test('viewer HTML rewrite errors identify missing upstream replacement points', () => {
    const viewerHtml = `<!doctype html>
<html>
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
    <link rel="resource" type="application/l10n" href="locale/locale.json">
    <script type="module" src="../build/pdf.mjs"></script>
    <link rel="stylesheet" href="viewer.css">
</head>
<body></body>
</html>`;

    assert.throws(
        () => rewritePdfjsViewerHtml(viewerHtml, urls),
        (error) => {
            assert.match(error.message, /PDF\.js viewer HTML rewrite failed/);
            assert.match(error.message, /viewer module script/);
            assert.match(error.message, /src="viewer\.mjs"/);
            return true;
        },
    );
});

test('rewrites required PDF.js viewer script asset URLs', () => {
    const viewerScript = `
const cmaps = { value: "../web/cmaps/" };
const iccs = { value: "../web/iccs/" };
const standardFonts = { value: "../web/standard_fonts/" };
const wasm = { value: "../web/wasm/" };
const worker = { value: "../build/pdf.worker.mjs" };
const sandbox = { value: "../build/pdf.sandbox.mjs" };
const debuggerScript = { value: "./debugger.mjs" };
const defaultDocument = { value: "compressed.tracemonkey-pldi-09.pdf" };
`;

    const rewrittenScript = rewritePdfjsViewerScript(viewerScript, urls);

    assert.match(rewrittenScript, /value: "https:\/\/mozilla\.github\.io\/pdf\.js\/web\/cmaps\/"/);
    assert.match(rewrittenScript, /value: "https:\/\/mozilla\.github\.io\/pdf\.js\/web\/iccs\/"/);
    assert.match(rewrittenScript, /value: "https:\/\/mozilla\.github\.io\/pdf\.js\/web\/standard_fonts\/"/);
    assert.match(rewrittenScript, /value: "https:\/\/mozilla\.github\.io\/pdf\.js\/web\/wasm\/"/);
    assert.match(rewrittenScript, /value: "https:\/\/mozilla\.github\.io\/pdf\.js\/build\/pdf\.worker\.mjs"/);
    assert.match(rewrittenScript, /value: "https:\/\/mozilla\.github\.io\/pdf\.js\/build\/pdf\.sandbox\.mjs"/);
    assert.match(rewrittenScript, /value: "https:\/\/mozilla\.github\.io\/pdf\.js\/web\/debugger\.mjs"/);
    assert.match(rewrittenScript, /value: ""/);
});

test('viewer script rewrite errors identify changed upstream constants', () => {
    const viewerScript = `
const cmaps = { value: "../web/cmaps/" };
const iccs = { value: "../web/iccs/" };
const standardFonts = { value: "../web/standard_fonts/" };
const wasm = { value: "../web/wasm/" };
const sandbox = { value: "../build/pdf.sandbox.mjs" };
const debuggerScript = { value: "./debugger.mjs" };
const defaultDocument = { value: "compressed.tracemonkey-pldi-09.pdf" };
`;

    assert.throws(
        () => rewritePdfjsViewerScript(viewerScript, urls),
        (error) => {
            assert.match(error.message, /PDF\.js viewer script rewrite failed/);
            assert.match(error.message, /worker script URL/);
            assert.match(error.message, /value: "\.\.\/build\/pdf\.worker\.mjs"/);
            return true;
        },
    );
});
