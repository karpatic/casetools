import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'docs/rsc/texlive/casetools-pdftex-manifest.json');
const manifestDir = path.dirname(manifestPath);
const cacheDir = path.join(manifestDir, 'cache');

const BINARY_EXTENSIONS = new Set([
    '.fmt',
    '.jpg',
    '.jpeg',
    '.map',
    '.pdf',
    '.pfb',
    '.pfm',
    '.png',
    '.tfm',
    '.vf',
]);

const TEXT_EXTENSIONS = new Set([
    '.cfg',
    '.clo',
    '.cls',
    '.def',
    '.dfu',
    '.enc',
    '.fd',
    '.sty',
    '.tex',
]);

test('validates the real CaseTools pdfTeX manifest and cache', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.deepEqual(validateTexliveManifest({
        manifest,
        manifestDir,
        cacheDir,
    }), []);
});

test('manifest validation catches broken cache declarations', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'casetools-texlive-manifest-'));
    const tempManifestDir = path.join(tempDir, 'texlive');
    const tempCacheDir = path.join(tempManifestDir, 'cache');
    fs.mkdirSync(tempCacheDir, { recursive: true });
    fs.writeFileSync(path.join(tempCacheDir, 'ok.sty'), 'ok');
    fs.writeFileSync(path.join(tempCacheDir, 'zero.tfm'), '');
    fs.writeFileSync(path.join(tempCacheDir, 'orphan.sty'), 'orphan');

    const errors = validateTexliveManifest({
        manifest: {
            files: [
                { name: 'zero.tfm', path: 'cache/zero.tfm', type: 'binary' },
                { name: 'ok.sty', path: 'cache/ok.sty', type: 'binary' },
                { name: 'OK.STY', path: 'cache/ok-copy.sty', type: 'text' },
                { name: 'copy.sty', path: 'cache/ok.sty', type: 'text' },
                { name: 'escape.sty', path: 'cache/../escape.sty', type: 'text' },
                { name: 'missing.tex', path: 'cache/missing.tex', type: 'text' },
            ],
        },
        manifestDir: tempManifestDir,
        cacheDir: tempCacheDir,
    });
    const message = errors.join('\n');

    assert.match(message, /not sorted/);
    assert.match(message, /duplicate case-insensitive manifest name: OK\.STY/);
    assert.match(message, /duplicate manifest path: cache\/ok\.sty/);
    assert.match(message, /path must be cache-relative without traversal: cache\/\.\.\/escape\.sty/);
    assert.match(message, /path must match flattened cache name: cache\/ok-copy\.sty/);
    assert.match(message, /missing cache file: cache\/missing\.tex/);
    assert.match(message, /zero-byte cache file: cache\/zero\.tfm/);
    assert.match(message, /type mismatch for ok\.sty: expected text, got binary/);
    assert.match(message, /orphan cache file: cache\/orphan\.sty/);

    fs.rmSync(tempDir, { recursive: true, force: true });
});

function validateTexliveManifest({ manifest, manifestDir, cacheDir }) {
    const errors = [];
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    if (!Array.isArray(manifest.files)) {
        errors.push('manifest files must be an array');
        return errors;
    }

    const seenNames = new Set();
    const seenPaths = new Set();
    const manifestPaths = new Set();
    let previousSortKey = '';

    for (const file of files) {
        const name = String(file.name || '');
        const cachePath = String(file.path || '');
        const sortKey = `${name.toLowerCase()}\0${name}`;

        if (previousSortKey && previousSortKey.localeCompare(sortKey) > 0) {
            errors.push(`manifest files are not sorted at ${name}`);
        }
        previousSortKey = sortKey;

        const foldedName = name.toLowerCase();
        if (seenNames.has(foldedName)) {
            errors.push(`duplicate case-insensitive manifest name: ${name}`);
        }
        seenNames.add(foldedName);

        if (seenPaths.has(cachePath)) {
            errors.push(`duplicate manifest path: ${cachePath}`);
        }
        seenPaths.add(cachePath);
        manifestPaths.add(cachePath);

        if (!isAllowedCachePath(cachePath)) {
            errors.push(`path must be cache-relative without traversal: ${cachePath}`);
        }
        if (cachePath !== `cache/${name}`) {
            errors.push(`path must match flattened cache name: ${cachePath}`);
        }

        const resolvedPath = path.join(manifestDir, cachePath);
        if (!resolvedPath.startsWith(`${cacheDir}${path.sep}`)) {
            errors.push(`path resolves outside cache: ${cachePath}`);
            continue;
        }
        if (!fs.existsSync(resolvedPath)) {
            errors.push(`missing cache file: ${cachePath}`);
            continue;
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            errors.push(`cache path is not a file: ${cachePath}`);
        } else if (stat.size === 0) {
            errors.push(`zero-byte cache file: ${cachePath}`);
        }

        const expectedType = expectedManifestType(name);
        if (!expectedType) {
            errors.push(`unsupported manifest extension: ${name}`);
        } else if (file.type !== expectedType) {
            errors.push(`type mismatch for ${name}: expected ${expectedType}, got ${file.type}`);
        }
    }

    for (const filename of fs.readdirSync(cacheDir)) {
        const fullPath = path.join(cacheDir, filename);
        if (fs.statSync(fullPath).isFile() && !manifestPaths.has(`cache/${filename}`)) {
            errors.push(`orphan cache file: cache/${filename}`);
        }
    }

    return errors;
}

function isAllowedCachePath(cachePath) {
    return (
        cachePath.startsWith('cache/')
        && !path.posix.isAbsolute(cachePath)
        && path.posix.normalize(cachePath) === cachePath
        && cachePath.split('/').length === 2
    );
}

function expectedManifestType(filename) {
    const extension = path.posix.extname(filename).toLowerCase();
    if (BINARY_EXTENSIONS.has(extension)) return 'binary';
    if (TEXT_EXTENSIONS.has(extension)) return 'text';
    return '';
}
