import { PDFDocument } from 'pdf-lib';

const LETTER = { width: 612, height: 792 }; // 8.5" x 11" at 72pt/in

async function fitPdfToLetter(pdfBytes) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const outDoc = await PDFDocument.create();

  const srcPages = srcDoc.getPages();
  for (const srcPage of srcPages) {
    const embedded = await outDoc.embedPage(srcPage);
    const { width: srcW, height: srcH } = srcPage.getSize();

    const scale = Math.min(LETTER.width / srcW, LETTER.height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const x = (LETTER.width - drawW) / 2;
    const y = (LETTER.height - drawH) / 2;

    const page = outDoc.addPage([LETTER.width, LETTER.height]);
    page.drawPage(embedded, { x, y, width: drawW, height: drawH });
  }

  return await outDoc.save();
}

export default fitPdfToLetter;
