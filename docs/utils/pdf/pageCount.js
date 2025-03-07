import { PDFDocument } from "pdf-lib";   
const pageCount = async (pdfBytes) => {
    try { 
      // escape any special characters in the path 
      const pdfDoc = await PDFDocument.load(pdfBytes); 
      const pageCount = pdfDoc.getPageCount(); 
      return pageCount;
    } catch (error) {
      console.error("Error loading PDF:", error);
    }
  };

export default pageCount;