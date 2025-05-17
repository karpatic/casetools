async function ocrPage(page, lang) {
    const canvas = document.createElement('canvas');
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const { data } = await Tesseract.recognize(canvas, lang, {
        logger: m => m.progress && console.log(`OCR: ${Math.round(m.progress * 100)}%`)
    });
    
    // Enhance the bbox data to include all coordinates
    data.lines = data.lines.map(line => {
        if (line.bbox) {
            const { x0, y0, x1, y1 } = line.bbox;
            line.bbox = { x0, y0, x1, y1 };
        }
        return line;
    });
    
    // Store viewport dimensions for coordinate transformation
    data.viewport = {
        width: viewport.width,
        height: viewport.height,
        scale: viewport.scale
    };
    
    canvas.remove();
    return data;
}

async function ocr(fileObj, progressCallback = null) {
    if (!fileObj) return "No file data available for OCR processing";
    const fileUrl = URL.createObjectURL(fileObj);
    try {
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const numPages = pdf.numPages;
        const pageTexts = [];
        
        for (let i = 1; i <= numPages; i++) {
            if (progressCallback) {
                progressCallback((i - 1) / numPages);
            }
            const page = await pdf.getPage(i);
            const pageData = await ocrPage(page, 'eng');
            pageData.page = i; // Add page number to the data
            pageTexts.push(pageData);
            
            if (progressCallback) {
                progressCallback(i / numPages);
            }
        }
        
        return pageTexts;
    } finally {
        URL.revokeObjectURL(fileUrl);
    }
}

export default ocr;