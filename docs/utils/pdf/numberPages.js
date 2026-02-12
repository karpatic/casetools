import { PDFDocument, rgb } from 'pdf-lib';

async function numberPages(pdfBytes, startNumber) {
  // Load the PDF document
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  let pageNumber = startNumber;

  // Embed once so we can measure text and avoid re-embedding every page
  const font = await pdfDoc.embedFont('Helvetica-Bold');

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width } = page.getSize();

    const text = `Page ${pageNumber}`;
    const fontSize = 16;
    const textY = 20;

    // Size a white box behind the text for visibility
    const paddingX = 6;
    const paddingY = 3;
    const borderWidth = 1;

    const textWidth = font.widthOfTextAtSize(text, fontSize);

    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = fontSize + paddingY * 2;

    const boxX = (width - boxWidth) / 2;
    const boxY = textY - paddingY; // approximate baseline-to-box alignment

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0, 0, 0),
      borderWidth,
    });

    // Draw the page number on top (single pass)
    page.drawText(text, {
      x: boxX + paddingX,
      y: textY + paddingY,
      size: fontSize,
      color: rgb(0, 0, 0),
      font,
    });

    pageNumber++;
  }

  // Save the modified PDF
  const modifiedPdfBytes = await pdfDoc.save();
  return modifiedPdfBytes;
}

export default numberPages;
// // Example Usage
// const inputPath = 'SCAN0000.pdf'; // Replace with your PDF path
// const startNumber = 5;        // Starting page number
// pdfNumberPages(inputPath, startNumber);
