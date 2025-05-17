import { PDFDocument, rgb } from 'pdf-lib';
import ocr from './../pdf/ocr.js';
import localforage from 'localforage';

async function extractTextFromEvidence(evidenceObj, progressCallback = null) {
  // Check if the text is already extracted
  let desiredOutput = evidenceObj?.extractedText;
  
  // Only perform OCR if extractedText doesn't exist
  if (!desiredOutput) {
    const evidenceStorageKey = evidenceObj?.storageKey || "";  
    const evidence = await localforage.getItem(evidenceStorageKey); 
    console.log('Extracting text from evidence', { evidence });
    
    // Perform OCR with progress reporting
    const tesseractOutput = await ocr(evidence, progressCallback);
    
    // Process the OCR output
    desiredOutput = tesseractOutput.map(item => {  
      const sentenceObj = item.lines.map(line => { 
        const { text, bbox } = line;
        return { text, bbox, page: item.page };
      });
      return sentenceObj;
    });
  }
  
  return desiredOutput;
}

async function markupDocument(evidenceObj) {
  console.log("Markup document", { evidenceObj });
  let { extractedSelections, storageKey } = evidenceObj;
  
  const pdfFile = await localforage.getItem(storageKey);  
  const pdfBytes = await pdfFile.arrayBuffer(); 
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages(); 
  
  // OCR scale factor from ocr.js
  const ocrScaleFactor = 1.5;
  
  for (const selection of extractedSelections) {
    const { page, text, x1, x2, y1 } = selection; 

    console.log("Markup selection", { page, text, x1, x2, y1 });
    
    // Page number is 1-indexed, but array is 0-indexed
    if (page <= 0 || page > pages.length) continue;
    const currentPage = pages[page-1];
    
    // Calculate rectangle dimensions from coordinates
    if (x1 !== undefined && x2 !== undefined && y1 !== undefined) {
      // Get page dimensions to properly calculate coordinates
      const { width: pageWidth, height: pageHeight } = currentPage.getSize();
      
      // Adjust for the scaling factor used during OCR (1.5x)
      // Convert from scaled OCR coordinates back to PDF coordinates
      const x = Math.min(x1, x2) / ocrScaleFactor;
      const width = Math.abs(x2 - x1) / ocrScaleFactor;
      
      // Adjust for PDF coordinate system (origin at bottom-left)
      // Convert y1 from top-down to bottom-up coordinate system, accounting for scale
      const y = pageHeight - (y1 / ocrScaleFactor) - 10 / ocrScaleFactor; 
      
      // Scale the height as well
      const height = 15 / ocrScaleFactor;
      
      // Draw a semi-transparent yellow highlight rectangle
      currentPage.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(1, 0.9, 0.3),  // Yellow highlight
        opacity: 0.3
      });
    }
  }
  
  const modifiedPdfBytes = await pdfDoc.save();
  const newKey = storageKey.replace(/\.pdf$/, "_markup.pdf");
  const newPdf = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
  await localforage.setItem(newKey, newPdf);
  return newPdf;
}

export { extractTextFromEvidence, markupDocument };