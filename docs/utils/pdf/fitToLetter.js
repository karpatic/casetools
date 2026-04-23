import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber } from 'pdf-lib';

const LETTER = { width: 612, height: 792 }; // 8.5" x 11" at 72pt/in
const ANNOTATION_COORDINATE_ARRAYS = ['RD', 'CL', 'Vertices', 'QuadPoints', 'L', 'Rect'];

function translateCoordinateArray(array, dx, dy) {
  for (let i = 0; i < array.size(); i++) {
    const value = array.lookup(i);
    if (value instanceof PDFNumber) {
      array.set(i, PDFNumber.of(value.asNumber() + (i % 2 === 0 ? dx : dy)));
    }
  }
}

function translateAnnotation(annot, dx, dy) {
  for (const key of ANNOTATION_COORDINATE_ARRAYS) {
    const list = annot.lookup(PDFName.of(key));
    if (list instanceof PDFArray) {
      translateCoordinateArray(list, dx, dy);
    }
  }

  const inkLists = annot.lookup(PDFName.of('InkList'));
  if (inkLists instanceof PDFArray) {
    for (let i = 0; i < inkLists.size(); i++) {
      const list = inkLists.lookup(i);
      if (list instanceof PDFArray) {
        translateCoordinateArray(list, dx, dy);
      }
    }
  }
}

function translateAnnotations(page, dx, dy) {
  const annots = page.node.Annots?.();
  if (!annots) return;

  for (let i = 0; i < annots.size(); i++) {
    const annot = annots.lookup(i);
    if (annot instanceof PDFDict) {
      translateAnnotation(annot, dx, dy);
    }
  }
}

async function fitPdfToLetter(pdfBytes) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const outDoc = await PDFDocument.create();

  // copyPages keeps page dictionaries intact, including page-level /Annots.
  const pages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
  for (const page of pages) {
    const { width: srcW, height: srcH } = page.getSize();
    if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW <= 0 || srcH <= 0) {
      outDoc.addPage(page);
      continue;
    }

    const scale = Math.min(LETTER.width / srcW, LETTER.height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const x = (LETTER.width - drawW) / 2;
    const y = (LETTER.height - drawH) / 2;

    page.setSize(LETTER.width, LETTER.height);
    page.scaleContent(scale, scale);
    page.scaleAnnotations(scale, scale);
    page.translateContent(x, y);
    translateAnnotations(page, x, y);
    outDoc.addPage(page);
  }

  return await outDoc.save();
}

export default fitPdfToLetter;
