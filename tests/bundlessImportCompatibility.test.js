import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appEntryPoint = path.join(repoRoot, 'docs/components/App.jsx');
const relativeJsSpecifierPattern = /(?:from\s*)?['"](\.{1,2}\/[^'"]+\.(?:js|jsx))['"]/;
const relativeDynamicImportPattern = /import\s*\(\s*['"](\.{1,2}\/[^'"]+\.(?:js|jsx))['"]\s*\)/g;

function collectImportStatements(source) {
    const lines = source.split(/\r?\n/);
    const statements = [];

    for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].trim().startsWith('import')) continue;

        const startLine = index + 1;
        let statement = lines[index];

        while (!statement.includes(';') && !relativeJsSpecifierPattern.test(statement) && index + 1 < lines.length) {
            index += 1;
            statement += `\n${lines[index]}`;
        }

        statements.push({ firstLine: lines[startLine - 1], startLine, statement });
    }

    return statements;
}

function collectSplitRelativeImports(source, filePath) {
    const offenders = [];

    for (const { firstLine, startLine, statement } of collectImportStatements(source)) {
        if (statement.includes('\n') && !relativeJsSpecifierPattern.test(firstLine) && relativeJsSpecifierPattern.test(statement)) {
            offenders.push(`${path.relative(repoRoot, filePath)}:${startLine}`);
        }
    }

    return offenders;
}

function collectBundlessModuleFiles(entryPoint) {
    const visited = new Set();
    const pending = [entryPoint];

    while (pending.length > 0) {
        const filePath = pending.pop();
        if (visited.has(filePath)) continue;
        visited.add(filePath);

        const source = readFileSync(filePath, 'utf8');

        for (const { statement } of collectImportStatements(source)) {
            const specifier = statement.match(relativeJsSpecifierPattern)?.[1];
            if (specifier) {
                pending.push(path.resolve(path.dirname(filePath), specifier));
            }
        }
    }

    return [...visited].sort();
}

function collectRelativeDynamicImports(source, filePath) {
    const offenders = [];
    let match;

    while ((match = relativeDynamicImportPattern.exec(source)) !== null) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        offenders.push(`${path.relative(repoRoot, filePath)}:${line}`);
    }

    return offenders;
}

test('Bundless app dependency graph keeps relative JS imports statically rewritable', () => {
    const moduleFiles = collectBundlessModuleFiles(appEntryPoint);
    assert.ok(
        moduleFiles.includes(path.join(repoRoot, 'docs/utils/createPacket.js')),
        'Regression coverage should include the packet creator loaded through the app entry point.',
    );
    assert.ok(
        moduleFiles.includes(path.join(repoRoot, 'docs/utils/pdftex/browserPdfTeXCompiler.js')),
        'Browser pdfTeX must be a static app dependency so Bundless can rewrite its relative imports.',
    );

    const splitImportOffenders = moduleFiles
        .flatMap(filePath => collectSplitRelativeImports(readFileSync(filePath, 'utf8'), filePath));
    const dynamicImportOffenders = moduleFiles
        .flatMap(filePath => collectRelativeDynamicImports(readFileSync(filePath, 'utf8'), filePath));

    assert.deepEqual(
        splitImportOffenders,
        [],
        'Bundless rewrites imports one line at a time; split relative JS imports are left unresolved in blob modules.',
    );
    assert.deepEqual(
        dynamicImportOffenders,
        [],
        'Bundless cannot resolve relative dynamic imports from blob modules; app graph imports must be statically rewritable.',
    );
});
