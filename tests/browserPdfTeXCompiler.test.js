import test from 'node:test';
import assert from 'node:assert/strict';

import {
    extractMissingTexFilenames,
    normalizeSameBasenameTexCompanionFileInput,
    normalizeSameBasenameTexCompanionInput,
    parseLsRIndex,
    resolveStaticTexLiveFallbackFiles,
    resolveStaticTexLivePath,
} from '../docs/utils/pdftex/browserPdfTeXCompiler.js';

test('extracts missing TeX filenames from pdfTeX logs and ignores generated aux files', () => {
    const log = [
        'No file main.aux.',
        "! LaTeX Error: File `newtxtext.sty' not found.",
        "! I can't find file `custom-macro.tex'.",
        "! LaTeX Error: File `newtxtext.sty' not found.",
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), [
        'newtxtext.sty',
        'custom-macro.tex',
    ]);
});

test('extracts exact SwiftLaTeX missing font diagnostics from pdfTeX logs', () => {
    const log = [
        "LaTeX Font Warning: Font shape `T1/ntxtlf/m/n' undefined",
        '! Font T1/cmr/m/n/12=ecrm1200 at 12.0pt not loadable: Metric (TFM) file not found.',
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), [
        'ecrm1200.tfm',
        't1ntxtlf.fd',
    ]);
});

test('extracts exact missing fd dependencies from pdfTeX no-file diagnostics', () => {
    const log = [
        'No file OMLntxmi.fd.',
        '! LaTeX Error: This NFSS system isn\'t set up properly.',
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), [
        'OMLntxmi.fd',
    ]);
});

test('extracts missing font metrics without a size segment', () => {
    const log = '! Font \\sixly=lasy6 not loadable: Metric (TFM) file not found.';

    assert.deepEqual(extractMissingTexFilenames(log), [
        'lasy6.tfm',
    ]);
});

test('extracts missing font diagnostics from wrapped pdfTeX log lines', () => {
    const log = [
        "LaTeX Font Warning: Font shape `T1/ntxtlf/m/n'",
        '(Font)              undefined',
        '! Font T1/cmr/m/n/12=ecrm1200 at 12.0pt not loadable: Metric (TFM) file',
        'not found.',
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), [
        'ecrm1200.tfm',
        't1ntxtlf.fd',
    ]);
});

test('extracts missing font metrics with TeX whitespace inside fixed diagnostic tokens', () => {
    const cases = [
        {
            name: 'unwrapped tokens',
            log: '! Font T1/cmr/m/n/12=ecrm1200 at 12.0pt not loadable: Metric (TFM) file not found.',
            expected: 'ecrm1200.tfm',
        },
        {
            name: 'observed TFM wrap',
            log: [
                '! Font OT1/ntxtlf/m/n/12=ntx-Regular-tlf-ot1 at 12.0pt not loadable: Metric (TF',
                'M) file not found.',
            ].join('\n'),
            expected: 'ntx-Regular-tlf-ot1.tfm',
        },
        {
            name: 'observed alternate TFM wrap',
            log: [
                '! Font OT1/ntxtlf/m/n/12=ntx-Regular-tlf-ot1 at 12.0pt not loadable: Metric (T',
                'FM) file not found.',
            ].join('\n'),
            expected: 'ntx-Regular-tlf-ot1.tfm',
        },
        {
            name: 'browser-verified TFM wrap after opening parenthesis',
            log: [
                '! Font T1/ntxtlf/b/it/12=ntx-BoldItalic-tlf-t1 at 12.0pt not loadable: Metric (',
                'TFM) file not found.',
            ].join('\n'),
            expected: 'ntx-BoldItalic-tlf-t1.tfm',
        },
        {
            name: 'TFM wrap before closing parenthesis',
            log: [
                '! Font T1/ntxtlf/b/it/12=ntx-BoldItalic-tlf-t1 at 12.0pt not loadable: Metric (TFM',
                ') file not found.',
            ].join('\n'),
            expected: 'ntx-BoldItalic-tlf-t1.tfm',
        },
        {
            name: 'observed file wrap',
            log: [
                '! Font T1/ntxtlf/b/n/12=ntx-Bold-tlf-t1 at 12.0pt not loadable: Metric (TFM) fi',
                'le not found.',
            ].join('\n'),
            expected: 'ntx-Bold-tlf-t1.tfm',
        },
        {
            name: 'observed alternate file wrap',
            log: [
                '! Font T1/ntxtlf/b/n/12=ntx-Bold-tlf-t1 at 12.0pt not loadable: Metric (TFM) f',
                'ile not found.',
            ].join('\n'),
            expected: 'ntx-Bold-tlf-t1.tfm',
        },
        {
            name: 'observed found wrap',
            log: [
                '! Font OML/ntxmi/m/it/12=ntxmi at 12.0pt not loadable: Metric (TFM) file not fo',
                'und.',
            ].join('\n'),
            expected: 'ntxmi.tfm',
        },
        {
            name: 'observed alternate found wrap',
            log: [
                '! Font OML/ntxmi/m/it/12=ntxmi at 12.0pt not loadable: Metric (TFM) file not f',
                'ound.',
            ].join('\n'),
            expected: 'ntxmi.tfm',
        },
        {
            name: 'arbitrary intra-token whitespace',
            log: [
                '! Font \\sixly=lasy6 not loadable: Metric (T',
                'F',
                'M) f',
                'i',
                'l',
                'e not f',
                'o',
                'u',
                'n',
                'd.',
            ].join('\n'),
            expected: 'lasy6.tfm',
        },
        {
            name: 'metric capture keeps existing tfm suffix',
            log: '! Font \\sixly=lasy6.tfm not loadable: Metric (TFM) file not found.',
            expected: 'lasy6.tfm',
        },
    ];

    for (const { name, log, expected } of cases) {
        assert.deepEqual(extractMissingTexFilenames(log), [expected], name);
    }
});

test('ignores non-metric missing font lookalikes', () => {
    const cases = [
        {
            name: 'missing leading bang Font diagnostic',
            log: 'Font \\sixly=lasy6 not loadable: Metric (TFM) file not found.',
        },
        {
            name: 'Type 1 missing font message',
            log: '! Font \\sixly=lasy6 not loadable: Type 1 file not found.',
        },
        {
            name: 'successful loaded font message',
            log: '! Font T1/cmr/m/n/12=ecrm1200 at 12.0pt loaded.',
        },
        {
            name: 'altered files wording',
            log: '! Font \\sixly=lasy6 not loadable: Metric (TFM) files not found.',
        },
        {
            name: 'altered metric token inside parentheses',
            log: '! Font \\sixly=lasy6 not loadable: Metric ( TFM extra ) file not found.',
        },
        {
            name: 'arbitrary prose',
            log: 'A note says ! Font \\sixly=lasy6 not loadable: Metric (TFM) file not found.',
        },
    ];

    for (const { name, log } of cases) {
        assert.deepEqual(extractMissingTexFilenames(log), [], name);
    }
});

test('deduplicates font diagnostic filenames with existing missing file matches', () => {
    const log = [
        'No file OMLntxmi.fd.',
        "! LaTeX Error: File `t1ntxtlf.fd' not found.",
        "LaTeX Font Warning: Font shape `T1/ntxtlf/m/n' undefined",
        "! LaTeX Error: File `ecrm1200.tfm' not found.",
        '! Font \\sixly=lasy6 not loadable: Metric (TFM) file not found.',
        '! Font T1/cmr/m/n/12=ecrm1200 at 12.0pt not loadable: Metric (TFM) file not found.',
        'No file OMLntxmi.fd.',
        '! Font \\sixly=lasy6 not loadable: Metric (TFM) file not found.',
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), [
        't1ntxtlf.fd',
        'ecrm1200.tfm',
        'OMLntxmi.fd',
        'lasy6.tfm',
    ]);
});

test('ignores successful font messages and unrelated font warnings', () => {
    const log = [
        "LaTeX Font Info:    Font shape `T1/ntxtlf/m/n' will be scaled",
        'Font T1/cmr/m/n/12=ecrm1200 at 12.0pt loaded.',
        "LaTeX Warning: Font shape `T1/ntxtlf/m/n' undefined references may change.",
        'Font \\sixly=lasy6 not loadable: Metric (TFM) file not found.',
        '! Font \\sixly=lasy6 not loadable: Type 1 file not found.',
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), []);
});

test('extracts exact pdfTeX fatal encoding-file diagnostics', () => {
    const log = '!pdfTeX error:  (file ntx-ec-tlf.enc): cannot open encoding file for reading';

    assert.deepEqual(extractMissingTexFilenames(log), [
        'ntx-ec-tlf.enc',
    ]);
});

test('extracts pdfTeX fatal encoding-file diagnostics through safe path cleanup', () => {
    const log = '!pdfTeX error:  (file ./fonts/enc/dvips/newtx/ntx-ec-tlf.enc): cannot open encoding file for reading';

    assert.deepEqual(extractMissingTexFilenames(log), [
        'ntx-ec-tlf.enc',
    ]);
});

test('deduplicates repeated pdfTeX fatal encoding-file diagnostics', () => {
    const log = [
        '!pdfTeX error:  (file ntx-ec-tlf.enc): cannot open encoding file for reading',
        '!pdfTeX error:  (file ntx-ec-tlf.enc): cannot open encoding file for reading',
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), [
        'ntx-ec-tlf.enc',
    ]);
});

test('ignores non-encoding pdfTeX cannot-open lookalikes', () => {
    const cases = [
        {
            name: 'missing leading bang pdfTeX error',
            log: 'pdfTeX error:  (file ntx-ec-tlf.enc): cannot open encoding file for reading',
        },
        {
            name: 'arbitrary cannot-open prose',
            log: 'A note says !pdfTeX error:  (file ntx-ec-tlf.enc): cannot open encoding file for reading',
        },
        {
            name: 'Type 1 missing font message',
            log: '!pdfTeX error:  (file ntx-Bold-tlf-t1.pfb): cannot open Type 1 font file for reading',
        },
        {
            name: 'altered cannot-open target',
            log: '!pdfTeX error:  (file ntx-ec-tlf.enc): cannot open map file for reading',
        },
        {
            name: 'non-encoding extension',
            log: '!pdfTeX error:  (file ntx-ec-tlf.map): cannot open encoding file for reading',
        },
        {
            name: 'unsupported traversal path',
            log: '!pdfTeX error:  (file ../ntx-ec-tlf.enc): cannot open encoding file for reading',
        },
    ];

    for (const { name, log } of cases) {
        assert.deepEqual(extractMissingTexFilenames(log), [], name);
    }
});

test('ignores generated auxiliary files in exact pdfTeX no-file diagnostics', () => {
    const log = [
        'No file main.aux.',
        'No file main.toc.',
        'No file main.out.',
    ].join('\n');

    assert.deepEqual(extractMissingTexFilenames(log), []);
});

test('resolves missing files against a TeX Live ls-R index for development fallback vendoring', () => {
    const index = parseLsRIndex(`
./tex/latex/base:
article.cls
size12.clo

./tex/latex/newtx:
newtxtext.sty
newtxmath.sty

./fonts/tfm/public/newtx:
ntx-Regular-tlf-t1.tfm
`);

    assert.deepEqual(resolveStaticTexLivePath(index, 'newtxtext'), {
        filename: 'newtxtext.sty',
        path: 'tex/latex/newtx/newtxtext.sty',
    });
    assert.deepEqual(resolveStaticTexLivePath(index, 'ntx-Regular-tlf-t1.tfm'), {
        filename: 'ntx-Regular-tlf-t1.tfm',
        path: 'fonts/tfm/public/newtx/ntx-Regular-tlf-t1.tfm',
    });
    assert.equal(resolveStaticTexLivePath(index, 'not-present.sty'), null);
});

test('prefers exact-case ls-R filename matches over case-insensitive matches', () => {
    const index = parseLsRIndex(`
./tex/latex/example:
CaseSensitive.fd
casesensitive.fd
`);

    assert.deepEqual(resolveStaticTexLivePath(index, 'CaseSensitive.fd'), {
        filename: 'CaseSensitive.fd',
        path: 'tex/latex/example/CaseSensitive.fd',
    });
});

test('resolves explicit ls-R filenames case-insensitively to the actual mirror filename', () => {
    const index = parseLsRIndex(`
./tex/latex/newtx:
omlntxmi.fd
`);

    assert.deepEqual(resolveStaticTexLivePath(index, 'OMLntxmi.fd'), {
        filename: 'omlntxmi.fd',
        path: 'tex/latex/newtx/omlntxmi.fd',
    });
});

test('does not resolve ambiguous case-insensitive ls-R filename matches', () => {
    const index = parseLsRIndex(`
./tex/latex/example:
CaseSensitive.fd
casesensitive.fd
`);

    assert.equal(resolveStaticTexLivePath(index, 'CASESENSITIVE.fd'), null);
});

test('resolves mixed-case no-file diagnostics through lowercase ls-R fd entries', () => {
    const log = [
        'No file OMLntxmi.fd.',
        '! LaTeX Error: This NFSS system isn\'t set up properly.',
    ].join('\n');
    const index = parseLsRIndex(`
./tex/latex/newtx:
omlntxmi.fd
`);

    assert.deepEqual(
        extractMissingTexFilenames(log).map(filename => resolveStaticTexLivePath(index, filename)),
        [
            {
                filename: 'omlntxmi.fd',
                path: 'tex/latex/newtx/omlntxmi.fd',
            },
        ],
    );
});

test('resolves bare TeX input names to .tex before package suffixes', () => {
    const index = parseLsRIndex(`
./tex/generic/xkeyval:
xkeyval.tex

./tex/latex/xkeyval:
xkeyval.sty
`);

    assert.deepEqual(resolveStaticTexLivePath(index, 'xkeyval'), {
        filename: 'xkeyval.tex',
        path: 'tex/generic/xkeyval/xkeyval.tex',
    });
    assert.deepEqual(resolveStaticTexLivePath(index, 'xkeyval.sty'), {
        filename: 'xkeyval.sty',
        path: 'tex/latex/xkeyval/xkeyval.sty',
    });
});

test('resolves explicit sty fallbacks with only same-basename tex companions', () => {
    const index = parseLsRIndex(`
./tex/generic/xkeyval:
xkeyval.tex

./tex/latex/xkeyval:
xkeyval.sty
other-xkeyval.cfg

./tex/latex/newtx:
newtxtext.sty
newtxmath.sty
`);

    assert.deepEqual(resolveStaticTexLiveFallbackFiles(index, 'xkeyval.sty'), [
        {
            filename: 'xkeyval.sty',
            path: 'tex/latex/xkeyval/xkeyval.sty',
        },
        {
            filename: 'xkeyval.tex',
            path: 'tex/generic/xkeyval/xkeyval.tex',
        },
    ]);
    assert.deepEqual(resolveStaticTexLiveFallbackFiles(index, 'newtxtext.sty'), [
        {
            filename: 'newtxtext.sty',
            path: 'tex/latex/newtx/newtxtext.sty',
        },
    ]);
});

test('normalizes a sty package bare self-input to its tex companion', () => {
    const source = [
        '\\NeedsTeXFormat{LaTeX2e}',
        '\\input xkeyval',
        '\\endinput',
    ].join('\n');

    assert.equal(
        normalizeSameBasenameTexCompanionInput(source, {
            filename: 'xkeyval.sty',
            companionFilename: 'xkeyval.tex',
            type: 'text',
        }),
        [
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\input xkeyval.tex',
            '\\endinput',
        ].join('\n'),
    );
});

test('normalizes manifest sty self-inputs through same-basename tex companions only', () => {
    const manifestFiles = [
        { name: 'cmr10.pfb', path: 'cache/cmr10.pfb', type: 'binary' },
        { name: 'xkeyval.sty', path: 'cache/xkeyval.sty', type: 'text' },
        { name: 'xkeyval.tex', path: 'cache/xkeyval.tex', type: 'text' },
        { name: 'xkvutils.tex', path: 'cache/xkvutils.tex', type: 'text' },
        { name: 'newtxtext.sty', path: 'cache/newtxtext.sty', type: 'text' },
    ];
    const source = [
        '\\ifx\\XKeyValLoaded\\endinput\\else\\input xkeyval \\fi',
        '\\input keyval',
        '\\input xkeyval-extra',
        'inline-xkeyval',
    ].join('\n');

    assert.equal(
        normalizeSameBasenameTexCompanionFileInput(source, {
            files: manifestFiles,
            filename: 'xkeyval.sty',
            type: 'text',
        }),
        [
            '\\ifx\\XKeyValLoaded\\endinput\\else\\input xkeyval.tex \\fi',
            '\\input keyval',
            '\\input xkeyval-extra',
            'inline-xkeyval',
        ].join('\n'),
    );
    assert.equal(
        normalizeSameBasenameTexCompanionFileInput('\\input newtxtext', {
            files: manifestFiles,
            filename: 'newtxtext.sty',
            type: 'text',
        }),
        '\\input newtxtext',
    );
    assert.equal(
        normalizeSameBasenameTexCompanionFileInput('\\input xkeyval', {
            files: manifestFiles,
            filename: 'xkeyval.sty',
            type: 'binary',
        }),
        '\\input xkeyval',
    );
});

test('leaves unrelated bare inputs unchanged during sty companion normalization', () => {
    const source = [
        '\\input keyval',
        '\\input xkeyval-extra',
        '\\input other',
    ].join('\n');

    assert.equal(
        normalizeSameBasenameTexCompanionInput(source, {
            filename: 'xkeyval.sty',
            companionFilename: 'xkeyval.tex',
            type: 'text',
        }),
        source,
    );
});

test('leaves explicit tex self-inputs unchanged during sty companion normalization', () => {
    const source = '\\input xkeyval.tex';

    assert.equal(
        normalizeSameBasenameTexCompanionInput(source, {
            filename: 'xkeyval.sty',
            companionFilename: 'xkeyval.tex',
            type: 'text',
        }),
        source,
    );
});

test('leaves sty files without a same-basename tex companion unchanged', () => {
    const source = '\\input newtxtext';

    assert.equal(
        normalizeSameBasenameTexCompanionInput(source, {
            filename: 'newtxtext.sty',
            companionFilename: null,
            type: 'text',
        }),
        source,
    );
});
