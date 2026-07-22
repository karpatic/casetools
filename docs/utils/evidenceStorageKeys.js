import { sanitizeForKey } from './utils.js';

class MissingEvidenceError extends Error {
    constructor(missingEvidence) {
        super(formatMissingEvidenceMessage(missingEvidence));
        this.name = 'MissingEvidenceError';
        this.missingEvidence = missingEvidence;
        this.userMessage = this.message;
    }
}

function buildEvidenceStorageKeys(pickedCase, fileName) {
    const storageKey = `${pickedCase}_${sanitizeForKey(fileName)}`;
    return {
        storageKey,
        markupStorageKey: storageKey.replace(/\.pdf$/i, '_markup.pdf'),
    };
}

function getPacketEvidence(selectedCase, packetKey) {
    const packetNumber = parseInt(packetKey.split('_')[1]);
    return [...(selectedCase?.evidence || [])]
        .filter(evidence => parseInt(evidence.evidencePacket) == packetNumber)
        .sort((a, b) => a.sortId - b.sortId);
}

function isPdfBlob(value) {
    return !!value && typeof value.arrayBuffer === 'function';
}

async function preflightEvidenceFiles(selectedCase, pickedCase, packetKey, getItem) {
    const packetEvidence = getPacketEvidence(selectedCase, packetKey);
    const preparedEvidence = [];
    const missingEvidence = [];

    for (const evidence of packetEvidence) {
        const { storageKey, markupStorageKey } = buildEvidenceStorageKeys(pickedCase, evidence.fileName);
        let pdfFile = await getItem(markupStorageKey);
        let foundStorageKey = markupStorageKey;

        if (!isPdfBlob(pdfFile)) {
            pdfFile = await getItem(storageKey);
            foundStorageKey = storageKey;
        }

        if (!isPdfBlob(pdfFile)) {
            missingEvidence.push({
                fileName: evidence.fileName,
                storageKey,
                markupStorageKey,
            });
            continue;
        }

        preparedEvidence.push({
            evidence,
            pdfFile,
            storageKey,
            markupStorageKey,
            foundStorageKey,
        });
    }

    if (missingEvidence.length > 0) {
        throw new MissingEvidenceError(missingEvidence);
    }

    return preparedEvidence;
}

function formatMissingEvidenceMessage(missingEvidence) {
    const plural = missingEvidence.length === 1 ? '' : 's';
    const details = missingEvidence
        .map(({ fileName, storageKey, markupStorageKey }) => (
            `"${fileName}" (storage key "${storageKey}" or markup key "${markupStorageKey}")`
        ))
        .join('; ');

    return `Cannot compile packet because ${missingEvidence.length} evidence PDF${plural} ${missingEvidence.length === 1 ? 'is' : 'are'} missing from this browser: ${details}. Please re-upload ${missingEvidence.length === 1 ? 'this evidence PDF' : 'these evidence PDFs'} and compile again.`;
}

export {
    MissingEvidenceError,
    buildEvidenceStorageKeys,
    getPacketEvidence,
    preflightEvidenceFiles,
};
