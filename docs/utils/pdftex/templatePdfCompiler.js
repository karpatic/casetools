import { selectPacketPdfCompilerMode } from './compilerMode.js';
import { compileLatexToPdfBlob } from './browserPdfTeXCompiler.js';
import { BrowserPdfTeXCompileError, pdfBytesToBlob } from './browserPdfTeXResult.js';
import { renderPandocLatexTemplate } from './pandocTemplateRenderer.js';

function createTemplatePdfCompiler({
    fetchImpl = globalThis.fetch.bind(globalThis),
    pandocUrl,
    environment = globalThis,
    logger = console,
    browserCompileLatex = defaultBrowserCompileLatex,
} = {}) {
    const mode = selectPacketPdfCompilerMode(environment);
    let useServerForRestOfPacket = mode.compiler !== 'browser-pdftex';

    return {
        mode,
        async compile({ templatePath, pandocText, templateData }) {
            const latex = await fetchImpl(templatePath, { cache: 'no-store' }).then(res => res.text());

            if (!useServerForRestOfPacket) {
                try {
                    const renderedLatex = renderPandocLatexTemplate(latex, templateData);
                    const browserResult = await browserCompileLatex(renderedLatex, {
                        templatePath,
                        devPackageFallback: mode.devPackageFallback,
                        logger,
                    });
                    return browserResult instanceof Blob ? browserResult : pdfBytesToBlob(browserResult);
                } catch (error) {
                    useServerForRestOfPacket = true;
                    surfaceBrowserPdfTeXFailure(error, { environment, logger, templatePath });
                }
            }

            return compileWithPandocServer({
                fetchImpl,
                logger,
                pandocUrl,
                text: pandocText,
                latex,
            });
        },
    };
}

async function compileWithPandocServer({ fetchImpl, logger, pandocUrl, text, latex }) {
    const response = await fetchImpl(pandocUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, latex }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('Error from Pandoc server:', errorText);
        throw new Error(`Pandoc conversion failed: ${response.statusText}`);
    }

    return response.blob();
}

function surfaceBrowserPdfTeXFailure(error, { environment, logger, templatePath }) {
    const detail = {
        templatePath,
        message: error?.message || String(error),
        status: error?.status,
        log: error?.log || '',
        missingFiles: error?.missingFiles || [],
        requestedFiles: error?.requestedFiles || [],
        loadedDevFiles: error?.loadedDevFiles || [],
    };
    const target = environment?.window || environment;

    try {
        target.__casetoolsLastBrowserPdfTeXError = detail;
    } catch {
        // Best-effort diagnostic state only.
    }

    if (target?.dispatchEvent && target?.CustomEvent) {
        try {
            target.dispatchEvent(new target.CustomEvent('casetools:pdftex-fallback', { detail }));
        } catch {
            // Console logging below is the durable diagnostic surface.
        }
    }

    logger.error('CaseTools browser pdfTeX failed; falling back to the Pandoc server.', detail, error);
}

async function defaultBrowserCompileLatex(latex, options) {
    return compileLatexToPdfBlob(latex, options);
}

export {
    BrowserPdfTeXCompileError,
    createTemplatePdfCompiler,
    pdfBytesToBlob,
};
