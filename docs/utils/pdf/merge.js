import { PDFDocument } from 'pdf-lib';

async function pdfMerge(arrayOfPdfsInByteFormat) {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Process each PDF in the input array
    for (const pdfBytes of arrayOfPdfsInByteFormat) {
      // Load the PDF
      const pdf = await PDFDocument.load(pdfBytes);
      
      // Get all pages from the PDF
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      // Add each page to the new document
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    } 
    
    return mergedPdf;
  } catch (error) {
    console.error('Error merging PDFs:', error);
    throw error;
  }
}

export default pdfMerge;

