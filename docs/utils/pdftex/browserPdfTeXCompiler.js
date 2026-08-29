import { BrowserPdfTeXCompileError, pdfBytesToBlob } from './browserPdfTeXResult.js';

const TEXBRAIN_SOURCE_COMMIT = '57b6a32b4d33cf94deb0b1c9260bb991df86cb86';
const TEXBRAIN_STATIC_TEXLIVE_MIRROR_ROOT = 'https://cdn.jsdelivr.net/gh/SachaNevsky/latexdiff-texmf-dist@aca46fc00975feebf98e038976790805c3e932df';
const CASETOOLS_PDFTEX_ENGINE_SCRIPT = 'rsc/swiftlatex/PdfTeXEngine.js';
const CASETOOLS_TEXLIVE_ENDPOINT = 'rsc/texlive/';
const CASETOOLS_TEXLIVE_MANIFEST = 'rsc/texlive/casetools-pdftex-manifest.json';
const MAIN_TEX_FILE = 'main.tex';
const MAX_DEV_FALLBACK_PASSES = 6;
const AMBIGUOUS_LS_R_CASE_FOLD_MATCH = Symbol('ambiguous ls-R case-fold match');
const lsRCaseFoldIndexes = new WeakMap();

const TEX_EXTENSIONS = [
    '',
    '.tex',
    '.tfm',
    '.pfb',
    '.vf',
    '.sty',
    '.cls',
    '.fd',
    '.def',
    '.cfg',
    '.clo',
    '.ltx',
    '.map',
    '.enc',
    '.dfu',
    '.ldf',
];

const BINARY_EXTENSIONS = new Set([
    '.fmt',
    '.pfb',
    '.pfm',
    '.tfm',
    '.vf',
    '.map',
    '.png',
    '.jpg',
    '.jpeg',
    '.pdf',
]);

let enginePromise = null;
let engineInstance = null;
let scriptLoadPromise = null;
let manifestPromise = null;
let lsrPromise = null;
const preloadedManifestEngines = new WeakSet();

async function compileLatexToPdfBlob(latex, options = {}) {
    const pdfBytes = await compileLatexToPdfBytes(latex, options);
    return pdfBytesToBlob(pdfBytes);
}

async function compileLatexToPdfBytes(latex, options = {}) {
    const {
        devPackageFallback = false,
        fetchImpl = globalThis.fetch?.bind(globalThis),
        logger = console,
        maxDevFallbackPasses = MAX_DEV_FALLBACK_PASSES,
    } = options;
    const requestedFiles = [];
    const loadedDevFiles = [];
    let lastResult = null;

    if (!fetchImpl) {
        throw new BrowserPdfTeXCompileError('Browser pdfTeX requires fetch to load engine assets.');
    }

    const engine = options.engine || await getBrowserPdfTeXEngine(options);
    await preloadManifestTexFiles(engine, { ...options, fetchImpl });

    for (let pass = 0; pass <= maxDevFallbackPasses; pass++) {
        lastResult = await runPdfTeXPass(engine, latex);
        if (lastResult.status === 0 && lastResult.pdf) {
            return lastResult.pdf;
        }

        const missingFiles = extractMissingTexFilenames(lastResult.log || '');
        for (const filename of missingFiles) addUnique(requestedFiles, filename);

        if (!devPackageFallback || missingFiles.length === 0 || pass === maxDevFallbackPasses) {
            break;
        }

        const fallback = await loadDevelopmentFallbackFiles({
            engine,
            missingFiles,
            fetchImpl,
            logger,
        });
        for (const filename of fallback.requestedFiles) addUnique(requestedFiles, filename);
        for (const filename of fallback.loadedFiles) addUnique(loadedDevFiles, filename);

        if (fallback.loadedFiles.length === 0) break;
    }

    throw createBrowserPdfTeXCompileError(lastResult, {
        requestedFiles,
        loadedDevFiles,
    });
}

async function getBrowserPdfTeXEngine(options = {}) {
    const environment = options.environment || globalThis;
    const target = environment.window || environment;

    if (engineInstance?.isReady?.()) return engineInstance;
    if (enginePromise) return enginePromise;

    enginePromise = (async () => {
        await loadPdfTeXEngineScript(options);
        const PdfTeXEngine = target.PdfTeXEngine || globalThis.PdfTeXEngine;
        if (typeof PdfTeXEngine !== 'function') {
            throw new BrowserPdfTeXCompileError('PdfTeXEngine was not available after loading browser pdfTeX assets.');
        }

        const engine = new PdfTeXEngine();
        await engine.loadEngine();
        engine.setTexliveEndpoint(resolveAssetUrl(options.texliveEndpoint || CASETOOLS_TEXLIVE_ENDPOINT, environment));
        engineInstance = engine;
        return engine;
    })();

    try {
        return await enginePromise;
    } catch (error) {
        enginePromise = null;
        if (error instanceof BrowserPdfTeXCompileError) throw error;
        throw new BrowserPdfTeXCompileError('Browser pdfTeX failed to initialize.', { cause: error });
    }
}

function loadPdfTeXEngineScript(options = {}) {
    const environment = options.environment || globalThis;
    const target = environment.window || environment;
    if (target.PdfTeXEngine || globalThis.PdfTeXEngine) return Promise.resolve();
    if (scriptLoadPromise) return scriptLoadPromise;

    const documentRef = target.document || globalThis.document;
    if (!documentRef?.createElement) {
        return Promise.reject(new BrowserPdfTeXCompileError('Browser pdfTeX requires a browser document to load engine assets.'));
    }

    const scriptUrl = resolveAssetUrl(options.engineScriptPath || CASETOOLS_PDFTEX_ENGINE_SCRIPT, environment);
    scriptLoadPromise = new Promise((resolve, reject) => {
        const existing = documentRef.querySelector?.(`script[src="${scriptUrl}"]`);
        if (existing) {
            resolve();
            return;
        }

        const script = documentRef.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new BrowserPdfTeXCompileError(`Failed to load browser pdfTeX engine asset: ${scriptUrl}`, {
            requestedFiles: [scriptUrl],
        }));
        documentRef.head.appendChild(script);
    });

    return scriptLoadPromise;
}

async function preloadManifestTexFiles(engine, options = {}) {
    if (preloadedManifestEngines.has(engine)) return;

    const manifest = await loadTexliveManifest(options);
    const manifestFiles = manifest.files || [];
    for (const file of manifestFiles) {
        const assetPath = file.path || `cache/${file.name}`;
        const assetName = file.name || basename(assetPath);
        const filename = file.memfsPath || `/tex/${assetName}`;
        const url = resolveAssetUrl(`${manifest.basePath || 'rsc/texlive/'}${assetPath}`, options.environment || globalThis);
        const response = await options.fetchImpl(url, { cache: 'force-cache' });
        if (!response.ok) {
            throw new BrowserPdfTeXCompileError(`Browser pdfTeX asset missing: ${file.name || assetPath}`, {
                requestedFiles: [file.name || assetPath],
            });
        }

        const fileType = file.type || inferFileType(assetName || assetPath);
        if (fileType === 'text') {
            const text = normalizeSameBasenameTexCompanionFileInput(await response.text(), {
                files: manifestFiles,
                filename: assetName,
                type: fileType,
            });
            engine.writeMemFSFile(filename, text);
        } else {
            engine.writeBinaryMemFSFile(filename, await response.arrayBuffer());
        }
    }

    preloadedManifestEngines.add(engine);
}

async function loadTexliveManifest(options = {}) {
    if (options.manifest) return options.manifest;
    if (manifestPromise) return manifestPromise;

    const fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    if (!fetchImpl) {
        throw new BrowserPdfTeXCompileError('Browser pdfTeX requires fetch to load the TeX Live manifest.');
    }

    const manifestUrl = resolveAssetUrl(options.manifestPath || CASETOOLS_TEXLIVE_MANIFEST, options.environment || globalThis);
    manifestPromise = (async () => {
        const response = await fetchImpl(manifestUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new BrowserPdfTeXCompileError(`Browser pdfTeX manifest unavailable: ${manifestUrl}`, {
                requestedFiles: [manifestUrl],
            });
        }
        return response.json();
    })();

    return manifestPromise;
}

async function runPdfTeXPass(engine, latex) {
    engine.flushCache?.();
    engine.writeMemFSFile(MAIN_TEX_FILE, latex);
    engine.setEngineMainFile(MAIN_TEX_FILE);

    const firstPass = await engine.compileLaTeX();
    if (firstPass.status !== 0) return firstPass;

    if (needsRerun(firstPass.log || '')) {
        return engine.compileLaTeX();
    }

    return firstPass;
}

function needsRerun(log) {
    return /Rerun to get|Rerun LaTeX|Please rerun|Label\(s\) may have changed|No file [^\s]+\.(aux|toc|lof|lot)/.test(log);
}

async function loadDevelopmentFallbackFiles({ engine, missingFiles, fetchImpl, logger }) {
    const index = await loadStaticMirrorIndex(fetchImpl);
    const requestedFiles = [];
    const loadedFiles = [];

    for (const missingFile of missingFiles) {
        addUnique(requestedFiles, missingFile);
        const fallbackFiles = resolveStaticTexLiveFallbackFiles(index, missingFile);
        for (const resolved of fallbackFiles) {
            if (loadedFiles.includes(resolved.filename)) continue;

            const response = await fetchImpl(encodeURI(`${TEXBRAIN_STATIC_TEXLIVE_MIRROR_ROOT}/${resolved.path}`), { cache: 'force-cache' });
            if (!response.ok) continue;

            const memfsPath = `/tex/${resolved.filename}`;
            const fileType = inferFileType(resolved.filename);
            if (fileType === 'text') {
                const text = normalizeSameBasenameTexCompanionFileInput(await response.text(), {
                    files: fallbackFiles,
                    filename: resolved.filename,
                    type: fileType,
                });
                engine.writeMemFSFile(memfsPath, text);
            } else {
                engine.writeBinaryMemFSFile(memfsPath, await response.arrayBuffer());
            }
            addUnique(loadedFiles, resolved.filename);
        }
    }

    if (requestedFiles.length > 0) {
        logger.info?.('CaseTools browser pdfTeX development package fallback requested TeX files.', {
            requestedFiles,
            loadedFiles,
        });
    }

    return { requestedFiles, loadedFiles };
}

async function loadStaticMirrorIndex(fetchImpl) {
    if (lsrPromise) return lsrPromise;
    lsrPromise = (async () => {
        const response = await fetchImpl(`${TEXBRAIN_STATIC_TEXLIVE_MIRROR_ROOT}/ls-R`, { cache: 'force-cache' });
        if (!response.ok) {
            throw new BrowserPdfTeXCompileError('Browser pdfTeX development package fallback could not load the pinned TeX Live index.', {
                requestedFiles: ['ls-R'],
            });
        }
        return parseLsRIndex(await response.text());
    })();
    return lsrPromise;
}

function createBrowserPdfTeXCompileError(result = {}, details = {}) {
    const log = result?.log || '';
    const missingFiles = unique([
        ...(details.missingFiles || []),
        ...extractMissingTexFilenames(log),
    ]);
    const requestedFiles = unique([
        ...(details.requestedFiles || []),
        ...missingFiles,
    ]);
    const loadedDevFiles = unique(details.loadedDevFiles || []);
    const status = result?.status;
    const message = Number.isFinite(status)
        ? `Browser pdfTeX failed with status ${status}.`
        : 'Browser pdfTeX failed.';

    return new BrowserPdfTeXCompileError(message, {
        status,
        log,
        missingFiles,
        requestedFiles,
        loadedDevFiles,
    });
}

function extractMissingTexFilenames(log) {
    const found = [];
    const safeEncodingPath = String.raw`(?:\.\/)?(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.enc`;
    const patterns = [
        /File [`']([^`']+)[`'] not found/g,
        /I can't find file [`']([^`']+)[`']/g,
        /kpathsea: Running mktex[^:]+:\s*([^.\s]+(?:\.[A-Za-z0-9]+)?)/g,
        /(?:^|\n)No file\s+([A-Za-z0-9_./-]+\.fd)\./g,
        new RegExp(String.raw`(?:^|\n)!pdfTeX error:\s+\(file\s+(${safeEncodingPath})\):\s+cannot\s+open\s+encoding\s+file\s+for\s+reading[ \t]*(?=\r?\n|$)`, 'g'),
    ];
    const texWhitespace = String.raw`[ \t\r\n]*`;
    const texToken = token => token.split('').join(texWhitespace);
    const missingFontMetricPattern = new RegExp(
        String.raw`(?:^|\n)!\s*Font\s+[^=\n]+=\s*([A-Za-z0-9_.-]+)(?:\s+at\s+[0-9.]+pt)?\s+not\s+loadable:\s*Metric\s*\(${texWhitespace}${texToken('TFM')}${texWhitespace}\)\s+${texToken('file')}\s+not\s+${texToken('found')}`,
        'g',
    );
    const undefinedFontShapePattern = /LaTeX Font Warning:\s*Font\s+shape\s+[`']([A-Za-z0-9]+)\/([A-Za-z0-9_.-]+)\/[^\/`'\s]+\/[^`'\s]+[`'](?:\s|\(Font\)\s*)*undefined/g;

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(log)) !== null) {
            const filename = cleanTexFilename(match[1]);
            if (filename && !isGeneratedAuxiliaryFile(filename)) {
                addUnique(found, filename);
            }
        }
    }

    let fontMetricMatch;
    while ((fontMetricMatch = missingFontMetricPattern.exec(log)) !== null) {
        const filename = cleanTexFilename(fontMetricMatch[1]);
        if (filename) addUnique(found, /\.tfm$/i.test(filename) ? filename : `${filename}.tfm`);
    }

    let fontShapeMatch;
    while ((fontShapeMatch = undefinedFontShapePattern.exec(log)) !== null) {
        addUnique(found, `${fontShapeMatch[1]}${fontShapeMatch[2]}.fd`.toLowerCase());
    }

    return found;
}

function parseLsRIndex(text) {
    const index = new Map();
    let currentDir = null;

    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('%')) continue;
        if (line.endsWith(':')) {
            currentDir = line.slice(0, -1).replace(/^\.\/?/, '').replace(/^\/+/, '');
            if (currentDir.startsWith('doc') || currentDir.startsWith('source')) currentDir = null;
            continue;
        }
        if (!currentDir) continue;
        if (!index.has(line)) index.set(line, currentDir);
    }

    return index;
}

function resolveStaticTexLivePath(index, requestedName) {
    const cleanName = cleanTexFilename(requestedName);
    if (!cleanName) return null;

    for (const candidate of texFilenameCandidates(cleanName)) {
        const dir = index.get(candidate);
        if (dir) {
            return {
                filename: candidate,
                path: `${dir}/${candidate}`,
            };
        }

        const folded = resolveCaseFoldedLsRFilename(index, candidate);
        if (folded) {
            return {
                filename: folded.filename,
                path: `${folded.dir}/${folded.filename}`,
            };
        }
    }

    return null;
}

function resolveCaseFoldedLsRFilename(index, candidate) {
    const entry = getLsRCaseFoldIndex(index).get(candidate.toLowerCase());
    return entry === AMBIGUOUS_LS_R_CASE_FOLD_MATCH ? null : entry;
}

function getLsRCaseFoldIndex(index) {
    let caseFoldIndex = lsRCaseFoldIndexes.get(index);
    if (caseFoldIndex) return caseFoldIndex;

    caseFoldIndex = new Map();
    for (const [filename, dir] of index) {
        const foldedName = filename.toLowerCase();
        const existing = caseFoldIndex.get(foldedName);
        if (!existing) {
            caseFoldIndex.set(foldedName, { filename, dir });
            continue;
        }
        if (existing !== AMBIGUOUS_LS_R_CASE_FOLD_MATCH && existing.filename !== filename) {
            caseFoldIndex.set(foldedName, AMBIGUOUS_LS_R_CASE_FOLD_MATCH);
        }
    }

    lsRCaseFoldIndexes.set(index, caseFoldIndex);
    return caseFoldIndex;
}

function resolveStaticTexLiveFallbackFiles(index, requestedName) {
    const resolved = resolveStaticTexLivePath(index, requestedName);
    if (!resolved) return [];

    const files = [resolved];
    const cleanName = cleanTexFilename(requestedName);
    if (/\.sty$/i.test(cleanName)) {
        const texCompanion = resolveStaticTexLivePath(index, cleanName.replace(/\.sty$/i, '.tex'));
        if (texCompanion) addResolvedFile(files, texCompanion);
    }

    return files;
}

function normalizeSameBasenameTexCompanionInput(text, { filename, companionFilename, type = 'text' } = {}) {
    if (type !== 'text') return text;

    const styBase = sameBasenameStyTexCompanionBase(filename, companionFilename);
    if (!styBase) return text;

    const escapedBase = escapeRegExp(styBase);
    return String(text).replace(
        new RegExp(`(\\\\input[ \\t\\r\\n]+)(${escapedBase})(?=([ \\t\\r\\n]|$))`, 'g'),
        '$1$2.tex',
    );
}

function normalizeSameBasenameTexCompanionFileInput(text, { files = [], filename, type = 'text' } = {}) {
    const companion = findSameBasenameTexCompanion(files, filename);
    return normalizeSameBasenameTexCompanionInput(text, {
        filename,
        companionFilename: texFileEntryName(companion),
        type,
    });
}

function findSameBasenameTexCompanion(files, filename) {
    const styName = basename(filename);
    return files.find(file => sameBasenameStyTexCompanionBase(styName, texFileEntryName(file)));
}

function sameBasenameStyTexCompanionBase(filename, companionFilename) {
    const styName = basename(filename);
    const texName = basename(companionFilename);
    if (!/\.sty$/i.test(styName) || !/\.tex$/i.test(texName)) return '';

    const styBase = styName.replace(/\.sty$/i, '');
    const texBase = texName.replace(/\.tex$/i, '');
    return styBase === texBase ? styBase : '';
}

function texFileEntryName(file) {
    return file?.filename || file?.name || basename(file?.path);
}

function texFilenameCandidates(name) {
    if (/\.[A-Za-z0-9]+$/.test(name)) return [name];
    return TEX_EXTENSIONS.map(ext => `${name}${ext}`);
}

function cleanTexFilename(value) {
    return String(value || '')
        .trim()
        .replace(/^["'`]+|["'`.]+$/g, '')
        .replace(/^\.\/+/, '')
        .split(/[\\/]/)
        .pop();
}

function isGeneratedAuxiliaryFile(filename) {
    return /\.(aux|log|out|toc|lof|lot|bbl|blg|fls|fdb_latexmk|synctex\.gz)$/i.test(filename);
}

function inferFileType(path) {
    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    return BINARY_EXTENSIONS.has(ext) ? 'binary' : 'text';
}

function basename(path) {
    return String(path || '').split('/').pop();
}

function resolveAssetUrl(path, environment = globalThis) {
    const base = environment?.location?.href || globalThis.location?.href;
    return base ? new URL(path, base).href : path;
}

function addUnique(list, value) {
    if (value && !list.includes(value)) list.push(value);
}

function addResolvedFile(list, file) {
    if (file && !list.some(existing => existing.filename === file.filename)) list.push(file);
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique(values) {
    const list = [];
    for (const value of values) addUnique(list, value);
    return list;
}

export {
    CASETOOLS_PDFTEX_ENGINE_SCRIPT,
    CASETOOLS_TEXLIVE_ENDPOINT,
    CASETOOLS_TEXLIVE_MANIFEST,
    TEXBRAIN_SOURCE_COMMIT,
    TEXBRAIN_STATIC_TEXLIVE_MIRROR_ROOT,
    compileLatexToPdfBlob,
    compileLatexToPdfBytes,
    createBrowserPdfTeXCompileError,
    extractMissingTexFilenames,
    normalizeSameBasenameTexCompanionFileInput,
    normalizeSameBasenameTexCompanionInput,
    parseLsRIndex,
    resolveStaticTexLiveFallbackFiles,
    resolveStaticTexLivePath,
};
