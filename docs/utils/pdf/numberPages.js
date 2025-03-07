import { PDFDocument, rgb } from 'pdf-lib';

async function numberPages(pdfBytes, startNumber) { 

  // Load the PDF document
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  let pageNumber = startNumber;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // Add the page number at the bottom center
    page.drawText(`Page ${pageNumber}`, {
      x: width / 2 - 50, // Adjust X for horizontal centering
      y: 20,             // Position near the bottom
      size: 12,
      color: rgb(0, 0, 0), // Black color
    });

    pageNumber++;
  }

  // Save the modified PDF
  const modifiedPdfBytes = await pdfDoc.save(); 

  // console.log(`Numbered PDF saved to ${outputPath}`);
  return modifiedPdfBytes;
}

export default numberPages
// // Example Usage
// const inputPath = 'SCAN0000.pdf'; // Replace with your PDF path
// const startNumber = 5;        // Starting page number
// pdfNumberPages(inputPath, startNumber);
