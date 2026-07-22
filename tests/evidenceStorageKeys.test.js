import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MissingEvidenceError,
    preflightEvidenceFiles,
} from '../docs/utils/evidenceStorageKeys.js';

const fakePdf = (label) => ({
    label,
    arrayBuffer: async () => new ArrayBuffer(1),
});

test('preflights packet evidence in packet order and prefers markup PDFs', async () => {
    const selectedCase = {
        evidence: [
            { fileName: 'Court Notice.pdf', evidencePacket: '1', sortId: 2, title: 'Notice' },
            { fileName: 'Lease Agreement.pdf', evidencePacket: '2', sortId: 1, title: 'Lease' },
            { fileName: 'ID & Passport.pdf', evidencePacket: '1', sortId: 1, title: 'ID' },
        ],
    };
    const storedFiles = new Map([
        ['Case A_ID___Passport_markup.pdf', fakePdf('markup')],
        ['Case A_Court_Notice.pdf', fakePdf('original')],
    ]);
    const requestedKeys = [];

    const preparedEvidence = await preflightEvidenceFiles(
        selectedCase,
        'Case A',
        'evidencePacket_1',
        async (key) => {
            requestedKeys.push(key);
            return storedFiles.get(key) || null;
        },
    );

    assert.deepEqual(preparedEvidence.map(({ evidence }) => evidence.fileName), [
        'ID & Passport.pdf',
        'Court Notice.pdf',
    ]);
    assert.equal(preparedEvidence[0].pdfFile.label, 'markup');
    assert.equal(preparedEvidence[1].pdfFile.label, 'original');
    assert.equal(preparedEvidence[0].storageKey, 'Case A_ID___Passport.pdf');
    assert.equal(preparedEvidence[0].markupStorageKey, 'Case A_ID___Passport_markup.pdf');
    assert.deepEqual(requestedKeys, [
        'Case A_ID___Passport_markup.pdf',
        'Case A_Court_Notice_markup.pdf',
        'Case A_Court_Notice.pdf',
    ]);
});

test('preflight error identifies missing evidence and tells the user to re-upload it', async () => {
    const selectedCase = {
        evidence: [
            { fileName: 'Police Report 1.pdf', evidencePacket: '3', sortId: 1, title: 'Police Report' },
        ],
    };

    await assert.rejects(
        preflightEvidenceFiles(selectedCase, 'Garcia Family', 'evidencePacket_3', async () => null),
        (error) => {
            assert.equal(error instanceof MissingEvidenceError, true);
            assert.match(error.message, /Police Report 1\.pdf/);
            assert.match(error.message, /Garcia Family_Police_Report_1\.pdf/);
            assert.match(error.message, /Garcia Family_Police_Report_1_markup\.pdf/);
            assert.match(error.message, /re-upload/i);
            return true;
        },
    );
});
