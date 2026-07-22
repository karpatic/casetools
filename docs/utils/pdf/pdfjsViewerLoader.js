const CONTENT_SECURITY_POLICY_META_TAG_PATTERN = /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*(?:"\s*content-security-policy\s*"|'\s*content-security-policy\s*'|content-security-policy\b))[^>]*>/gi;

function replaceRequiredLiteral(source, search, replacement, label, target) {
    const matchCount = source.split(search).length - 1;
    if (matchCount !== 1) {
        throw new Error(
            `${target} rewrite failed for ${label}. Expected exactly one occurrence of ${search}, found ${matchCount}. The upstream PDF.js viewer changed; update the CaseTools PDF.js loader.`
        );
    }
    return source.split(search).join(replacement);
}

function removeContentSecurityPolicyMetaTags(html, target = 'PDF.js viewer HTML') {
    const matches = html.match(CONTENT_SECURITY_POLICY_META_TAG_PATTERN) || [];
    if (matches.length !== 1) {
        throw new Error(
            `${target} rewrite failed for content security policy meta tag. Expected exactly one upstream Content-Security-Policy meta tag, found ${matches.length}. The upstream PDF.js viewer changed; update the CaseTools PDF.js loader.`
        );
    }
    return html.replace(CONTENT_SECURITY_POLICY_META_TAG_PATTERN, '');
}

function rewritePdfjsViewerHtml(viewerHtml, {
    pdfjsWebUrl,
    pdfjsBuildUrl,
    viewerScriptUrl,
    bridgeUrl,
}) {
    const target = 'PDF.js viewer HTML';
    let rewrittenHtml = removeContentSecurityPolicyMetaTags(viewerHtml, target);

    rewrittenHtml = replaceRequiredLiteral(
        rewrittenHtml,
        'href="locale/locale.json"',
        `href="${pdfjsWebUrl}locale/locale.json"`,
        'locale manifest URL',
        target,
    );
    rewrittenHtml = replaceRequiredLiteral(
        rewrittenHtml,
        'src="../build/pdf.mjs"',
        `src="${pdfjsBuildUrl}pdf.mjs"`,
        'PDF.js module script',
        target,
    );
    rewrittenHtml = replaceRequiredLiteral(
        rewrittenHtml,
        'href="viewer.css"',
        `href="${pdfjsWebUrl}viewer.css"`,
        'viewer stylesheet URL',
        target,
    );
    rewrittenHtml = replaceRequiredLiteral(
        rewrittenHtml,
        'src="viewer.mjs"',
        `src="${viewerScriptUrl}"`,
        'viewer module script',
        target,
    );
    return replaceRequiredLiteral(
        rewrittenHtml,
        '</body>',
        `<script src="${bridgeUrl}"><\/script></body>`,
        'bridge script injection point',
        target,
    );
}

function rewritePdfjsViewerScript(viewerScript, {
    pdfjsWebUrl,
    pdfjsBuildUrl,
}) {
    let rewrittenScript = viewerScript;
    const target = 'PDF.js viewer script';

    rewrittenScript = replaceRequiredLiteral(
        rewrittenScript,
        'value: "../web/cmaps/"',
        `value: "${pdfjsWebUrl}cmaps/"`,
        'cMaps URL',
        target,
    );
    rewrittenScript = replaceRequiredLiteral(
        rewrittenScript,
        'value: "../web/iccs/"',
        `value: "${pdfjsWebUrl}iccs/"`,
        'ICC profiles URL',
        target,
    );
    rewrittenScript = replaceRequiredLiteral(
        rewrittenScript,
        'value: "../web/standard_fonts/"',
        `value: "${pdfjsWebUrl}standard_fonts/"`,
        'standard fonts URL',
        target,
    );
    rewrittenScript = replaceRequiredLiteral(
        rewrittenScript,
        'value: "../web/wasm/"',
        `value: "${pdfjsWebUrl}wasm/"`,
        'WASM URL',
        target,
    );
    rewrittenScript = replaceRequiredLiteral(
        rewrittenScript,
        'value: "../build/pdf.worker.mjs"',
        `value: "${pdfjsBuildUrl}pdf.worker.mjs"`,
        'worker script URL',
        target,
    );
    rewrittenScript = replaceRequiredLiteral(
        rewrittenScript,
        'value: "../build/pdf.sandbox.mjs"',
        `value: "${pdfjsBuildUrl}pdf.sandbox.mjs"`,
        'sandbox script URL',
        target,
    );
    rewrittenScript = replaceRequiredLiteral(
        rewrittenScript,
        'value: "./debugger.mjs"',
        `value: "${pdfjsWebUrl}debugger.mjs"`,
        'debugger script URL',
        target,
    );
    return replaceRequiredLiteral(
        rewrittenScript,
        'value: "compressed.tracemonkey-pldi-09.pdf"',
        'value: ""',
        'default PDF URL',
        target,
    );
}

export {
    removeContentSecurityPolicyMetaTags,
    rewritePdfjsViewerHtml,
    rewritePdfjsViewerScript,
};
