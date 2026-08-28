import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PACKET_TEMPLATE_PATHS,
    compilePacketFrontMatterPdfs,
    compilePacketTableOfContentsPdf,
} from '../docs/utils/pdftex/packetTemplatePdfs.js';

const sampleBasics = {
    attorney: {
        attorney_name: 'Atty. Rivera',
        case_type: 'Removal',
    },
    cover: {
        cover_department: 'Department of Justice',
        cover_division: 'Executive Office',
        cover_location: 'New York',
        cover_name: 'Immigration Court',
    },
    certificate: {
        certificate_department: 'DHS',
        certificate_division: 'ICE',
        certificate_name: 'OPLA',
    },
    respondents: [
        {
            full_name: 'Ana Perez',
            file_numbers: ['A001'],
            status: 'Principal',
        },
    ],
};

function captureCompiler() {
    const calls = [];
    return {
        calls,
        compiler: {
            compile: async (input) => {
                calls.push(input);
                return new Blob([input.templatePath], { type: 'application/pdf' });
            },
        },
    };
}

test('routes packet front matter and TOC through a template compiler with the existing Pandoc text contracts', async () => {
    const { calls, compiler } = captureCompiler();
    const packetConfig = { packetTitle: 'Motion & Evidence' };
    const contents = [
        { letter: 'A', title: 'Lease', pageRange: '1 - 2' },
        { letter: 'B', title: 'Tax Return', pageRange: '3' },
    ];

    const frontMatter = await compilePacketFrontMatterPdfs({
        compiler,
        config: sampleBasics,
        packetConfig,
        metadataPandocText: '---metadata---',
    });
    const tocPdf = await compilePacketTableOfContentsPdf({
        compiler,
        config: sampleBasics,
        packetConfig,
        contents,
        tableOfContentsPandocText: 'toc-yaml',
    });

    assert.equal(await frontMatter.certificatePdf.text(), PACKET_TEMPLATE_PATHS.certificate);
    assert.equal(await frontMatter.coverPdf.text(), PACKET_TEMPLATE_PATHS.cover);
    assert.equal(await tocPdf.text(), PACKET_TEMPLATE_PATHS.toc);
    assert.deepEqual(calls.map(call => call.templatePath), [
        PACKET_TEMPLATE_PATHS.certificate,
        PACKET_TEMPLATE_PATHS.cover,
        PACKET_TEMPLATE_PATHS.toc,
    ]);
    assert.deepEqual(calls.map(call => call.pandocText), [
        '---metadata---',
        '---metadata---',
        'toc-yaml',
    ]);
    assert.equal(calls[0].templateData.document.title, 'Motion & Evidence');
    assert.deepEqual(calls[0].templateData.contents, []);
    assert.deepEqual(calls[2].templateData.contents, contents);
});
