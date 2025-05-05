async function ocrPage(page, lang) {
    const canvas = document.createElement('canvas');
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const { data } = await Tesseract.recognize(canvas, lang, {
        logger: m => m.progress && console.log(`OCR: ${Math.round(m.progress * 100)}%`)
    });    
    canvas.remove();
    return data;
}

async function ocr(fileObj) {
    if (!fileObj) return "No file data available for OCR processing";
    const fileUrl = URL.createObjectURL(fileObj);
    try {
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const numPages = pdf.numPages;
        const pageTexts = [];
        for (let i = 1; i <= numPages; i++) { 
            pageTexts.push(await ocrPage(await pdf.getPage(i), 'eng'));
        }
        return pageTexts;
    } finally {
        URL.revokeObjectURL(fileUrl);
    }
}

export default ocr;