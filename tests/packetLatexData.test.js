import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPacketLatexData } from '../docs/utils/pdftex/packetLatexData.js';
import { renderPandocLatexTemplate } from '../docs/utils/pdftex/pandocTemplateRenderer.js';

const sampleBasics = {
    attorney: {
        attorney_name: 'Atty. Rivera & Co.',
        address: '1 Main_St',
        city: 'New York, NY',
        phone: '555#1234',
        email: 'rivera@example.com',
        eoir_id: 'EOIR$42',
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
        certificate_location_address: '26 Federal Plaza',
        certificate_location_linetwo: 'Room 1130',
        certificate_location_statezip: 'New York, NY 10278',
    },
    judge: {
        judge_name: 'Hon. Example',
        hearing_date: 'January 2, 2027',
        hearing_time: '9:00 AM',
    },
    respondents: [
        {
            full_name: 'Ana Pérez',
            file_numbers: ['A001', 'A002'],
            status: 'Principal',
        },
        {
            full_name: 'Ben {Minor}',
            file_numbers: ['B001'],
            status: 'Derivative',
        },
    ],
};

const pandocMarkerPattern = /\$if\(|\$for\(|\$endif\$|\$endfor\$|\$\{|(?:^|[^\\])\$it(?:\.|\$)/;

test('builds browser template data with the metadata paths used by packet templates', () => {
    const data = createPacketLatexData(sampleBasics, { packetTitle: 'Motion & Evidence' }, [
        { letter: 'A', title: 'Lease_1', pageRange: '1 - 2' },
    ]);

    assert.equal(data.attorney.attorney_name, 'Atty. Rivera & Co.');
    assert.equal(data.cover.cover_name, 'Immigration Court');
    assert.equal(data.certificate.certificate_location_statezip, 'New York, NY 10278');
    assert.equal(data.judge.hearing_time, '9:00 AM');
    assert.deepEqual(data.respondents[0].file_numbers_rest, ['A002']);
    assert.equal(data.respondents[0].count, 1);
    assert.equal(data.respondents[1].status, 'Derivative');
    assert.deepEqual(data.document, {
        title: 'Motion & Evidence',
        multipleRespondents: true,
    });
    assert.deepEqual(data.contents, [
        { letter: 'A', title: 'Lease_1', pageRange: '1 - 2' },
    ]);
});

test('builds browser template data for respondent file_numbers arrays and legacy file_number values', () => {
    const data = createPacketLatexData({
        ...sampleBasics,
        respondents: [
            {
                full_name: 'Modern Respondent',
                file_numbers: ['A001', 'A002'],
                file_number: 'SHOULD-NOT-WIN',
                status: 'Principal',
            },
            {
                full_name: 'Legacy Respondent',
                file_number: 'B001',
                status: 'Derivative',
            },
        ],
    }, { packetTitle: 'Motion & Evidence' });

    assert.equal(data.respondents[0].file_number_one, 'A001');
    assert.deepEqual(data.respondents[0].file_numbers_rest, ['A002']);
    assert.equal(data.respondents[1].file_number_one, 'B001');
    assert.deepEqual(data.respondents[1].file_numbers_rest, []);
});

test('renders the existing certificate, cover, and toc templates into complete LaTeX without Pandoc markers', () => {
    const data = createPacketLatexData(sampleBasics, { packetTitle: 'Motion & Evidence' }, [
        { letter: 'A', title: 'Lease_1', pageRange: '1 - 2' },
        { letter: 'B', title: 'Tax {Return}', pageRange: '3' },
    ]);

    for (const path of [
        'docs/rsc/latex/certificate.tex',
        'docs/rsc/latex/cover.tex',
        'docs/rsc/latex/toc.tex',
    ]) {
        const rendered = renderPandocLatexTemplate(readFileSync(path, 'utf8'), data);
        assert.match(rendered, /\\documentclass/);
        assert.match(rendered, /\\begin\{document\}/);
        assert.doesNotMatch(rendered, pandocMarkerPattern);
    }
});

test('renders certificate respondent file-number breaks without standalone directive blank lines', () => {
    const data = createPacketLatexData(sampleBasics, { packetTitle: 'Motion & Evidence' }, []);
    const rendered = renderPandocLatexTemplate(readFileSync('docs/rsc/latex/certificate.tex', 'utf8'), data);

    assert.match(rendered, /Ana Pérez[^\n]*File No\.: A001[^\n]*\n[ \t]*\\\\\n[ \t]*\\makebox\[[^\n]+A002/);
    assert.doesNotMatch(rendered, pandocMarkerPattern);
    assert.doesNotMatch(rendered, /Ana Pérez[^\n]*A001[^\n]*\n[ \t]*\n[ \t]*\\\\/);
});
