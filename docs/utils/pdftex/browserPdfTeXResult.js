class BrowserPdfTeXCompileError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'BrowserPdfTeXCompileError';
        this.status = details.status;
        this.log = details.log || '';
        this.missingFiles = details.missingFiles || [];
        this.requestedFiles = details.requestedFiles || [];
        this.loadedDevFiles = details.loadedDevFiles || [];
        this.cause = details.cause;
    }
}

function pdfBytesToBlob(pdfBytes, BlobCtor = Blob) {
    const bytes = normalizePdfBytes(pdfBytes);
    if (!hasPdfHeader(bytes)) {
        throw new BrowserPdfTeXCompileError('Browser pdfTeX returned malformed PDF bytes.');
    }
    return new BlobCtor([bytes], { type: 'application/pdf' });
}

function normalizePdfBytes(pdfBytes) {
    if (pdfBytes instanceof Uint8Array) return pdfBytes;
    if (pdfBytes instanceof ArrayBuffer) return new Uint8Array(pdfBytes);
    if (ArrayBuffer.isView(pdfBytes)) {
        return new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
    }
    throw new BrowserPdfTeXCompileError('Browser pdfTeX returned an unsupported PDF byte container.');
}

function hasPdfHeader(bytes) {
    if (bytes.length < 5) return false;
    return bytes[0] === 0x25
        && bytes[1] === 0x50
        && bytes[2] === 0x44
        && bytes[3] === 0x46
        && bytes[4] === 0x2d;
}

export {
    BrowserPdfTeXCompileError,
    pdfBytesToBlob,
};
