import { AnnotationEditorType, AnnotationType, getDocument, GlobalWorkerOptions, Util } from 'pdfjs-dist';
import ocr from './../pdf/ocr.js';
import localforage from 'localforage';

const PDFJS_WORKER_SRC = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
const OCR_SCALE_FACTOR = 1.5;
const HIGHLIGHT_ANNOTATION_TYPE = AnnotationEditorType?.HIGHLIGHT ?? AnnotationType?.HIGHLIGHT ?? 9;
const HIGHLIGHT_COLOR = [255, 230, 77];
const HIGHLIGHT_OPACITY = 0.3;
const HIGHLIGHT_TOP_PADDING = 5;
const HIGHLIGHT_BOTTOM_PADDING = 10;
const BBOX_PADDING = 1;
const TEXT_RECT_PADDING = 1;

if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
}

async function extractTextFromEvidence(evidenceObj, progressCallback = null) {
  // Check if the text is already extracted
  let desiredOutput = evidenceObj?.extractedText;
  // Only perform OCR if extractedText doesn't exist // if (!desiredOutput) {
  const evidenceStorageKey = evidenceObj?.storageKey || "";  
  const evidence = await localforage.getItem(evidenceStorageKey); 
  console.log('Extracting text from evidence', { evidence });
  
  // Perform OCR with progress reporting
  const tesseractOutput = await ocr(evidence, progressCallback);  
  // console.log("Tesseract OCR output:", tesseractOutput);
  
  // Process the OCR output
  desiredOutput = tesseractOutput.map((item, pageIndex) => {  
    const lineObjects = item.lines.map(line => { 
      const { text, bbox, words } = line;
      // FILTER WORDS FOR JUST THE WORD AND BBOX
      let filteredWords = words.map(word => {
        const { text: wordText, bbox: wordBbox } = word;
        return { text: wordText, bbox: wordBbox };
      });
      const lineObject = { pageNumber: pageIndex + 1, lineText: text, words: filteredWords };
      if (bbox) {
        lineObject.bbox = bbox;
        lineObject.x1 = bbox.x0;
        lineObject.x2 = bbox.x1;
        lineObject.y1 = bbox.y0;
      }
      return lineObject;
    });
    return lineObjects;
  }); 
  console.log("Processed OCR output:", desiredOutput);
  return desiredOutput;
}

function getHighlightRectInOcrSpace(selection) {
  const source = selection.bbox || selection;
  const hasOcrBbox = source.x0 != null && source.x1 != null && source.y0 != null && source.y1 != null;

  if (hasOcrBbox && source.x2 == null) {
    const left = Number(source.x0);
    const right = Number(source.x1);
    const top = Number(source.y0) - BBOX_PADDING;
    const bottom = Number(source.y1) + BBOX_PADDING;
    if (![left, right, top, bottom].every(Number.isFinite) || left === right || top === bottom) {
      return null;
    }
    return {
      left: Math.min(left, right),
      right: Math.max(left, right),
      top: Math.min(top, bottom),
      bottom: Math.max(top, bottom),
    };
  }

  const x1 = Number(source.x1);
  const x2 = Number(source.x2);
  const y1 = Number(source.y1);
  if (![x1, x2, y1].every(Number.isFinite)) {
    return null;
  }

  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  if (left === right) {
    return null;
  }

  return {
    left,
    right,
    top: y1 - HIGHLIGHT_TOP_PADDING,
    bottom: y1 + HIGHLIGHT_BOTTOM_PADDING,
  };
}

function getSelectionPageNumber(selection) {
  return Number(selection.page ?? selection.pageNumber);
}

function viewportRectToPdfQuad(viewport, rect) {
  const topLeft = viewport.convertToPdfPoint(rect.left, rect.top);
  const topRight = viewport.convertToPdfPoint(rect.right, rect.top);
  const bottomLeft = viewport.convertToPdfPoint(rect.left, rect.bottom);
  const bottomRight = viewport.convertToPdfPoint(rect.right, rect.bottom);

  return [
    topLeft[0], topLeft[1],
    topRight[0], topRight[1],
    bottomLeft[0], bottomLeft[1],
    bottomRight[0], bottomRight[1],
  ];
}

function getBoundingRect(points) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < points.length; i += 2) {
    xs.push(points[i]);
    ys.push(points[i + 1]);
  }
  return [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];
}

function getHighlightOutline([x1, y1, x2, y2, x3, y3, x4, y4]) {
  return [
    x1, y1,
    x2, y2,
    x4, y4,
    x3, y3,
  ];
}

function createHighlightAnnotation({ pageIndex, rotation, quadPoints }) {
  return {
    annotationType: HIGHLIGHT_ANNOTATION_TYPE,
    color: HIGHLIGHT_COLOR,
    date: new Date(),
    opacity: HIGHLIGHT_OPACITY,
    pageIndex,
    quadPoints,
    rect: getBoundingRect(quadPoints),
    rotation,
    outlines: [getHighlightOutline(quadPoints)],
  };
}

async function getPdfSourceBytes(pdfSource) {
  if (pdfSource instanceof Blob) {
    return await pdfSource.arrayBuffer();
  }
  if (pdfSource instanceof ArrayBuffer) {
    return pdfSource.slice(0);
  }
  if (ArrayBuffer.isView(pdfSource)) {
    const view = pdfSource;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  throw new Error('Unsupported PDF source for highlight extraction.');
}

function normalizeRect(rect) {
  return {
    left: Math.min(rect.left, rect.right),
    right: Math.max(rect.left, rect.right),
    top: Math.min(rect.top, rect.bottom),
    bottom: Math.max(rect.top, rect.bottom),
  };
}

function combineRects(rects) {
  return {
    left: Math.min(...rects.map(rect => rect.left)),
    right: Math.max(...rects.map(rect => rect.right)),
    top: Math.min(...rects.map(rect => rect.top)),
    bottom: Math.max(...rects.map(rect => rect.bottom)),
  };
}

function getAnnotationViewportRects(annotation, viewport) {
  const quadPoints = annotation.quadPoints;
  const rects = [];

  if (quadPoints?.length) {
    for (let i = 0; i < quadPoints.length; i += 8) {
      const points = [];
      for (let j = 0; j < 8; j += 2) {
        points.push(viewport.convertToViewportPoint(quadPoints[i + j], quadPoints[i + j + 1]));
      }
      rects.push(normalizeRect({
        left: Math.min(...points.map(point => point[0])),
        right: Math.max(...points.map(point => point[0])),
        top: Math.min(...points.map(point => point[1])),
        bottom: Math.max(...points.map(point => point[1])),
      }));
    }
    return rects;
  }

  if (annotation.rect?.length === 4) {
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect);
    rects.push(normalizeRect({ left: x1, top: y1, right: x2, bottom: y2 }));
  }

  return rects;
}

function getTextItemViewportRect(item, viewport, styles) {
  if (!item?.str?.trim()) {
    return null;
  }

  const transform = Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(transform[2], transform[3]) || Math.abs(item.height || 0) * viewport.scale;
  const width = Math.abs(item.width || 0) * viewport.scale;
  const style = styles?.[item.fontName] || {};
  let top;

  if (Number.isFinite(style.ascent)) {
    top = transform[5] - fontHeight * style.ascent;
  } else if (Number.isFinite(style.descent)) {
    top = transform[5] - fontHeight * (1 + style.descent);
  } else {
    top = transform[5] - fontHeight;
  }

  return normalizeRect({
    left: transform[4],
    right: transform[4] + width,
    top,
    bottom: top + fontHeight,
  });
}

function rectsIntersect(a, b, padding = 0) {
  return !(
    a.right + padding < b.left ||
    b.right + padding < a.left ||
    a.bottom + padding < b.top ||
    b.bottom + padding < a.top
  );
}

function getTextForHighlightRects(textItems, highlightRects) {
  const included = textItems.filter(item =>
    highlightRects.some(rect => rectsIntersect(item.rect, rect, TEXT_RECT_PADDING))
  );
  return included
    .map(item => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function isHighlightAnnotation(annotation) {
  return annotation.annotationType === HIGHLIGHT_ANNOTATION_TYPE ||
    annotation.annotationType === AnnotationType?.HIGHLIGHT ||
    annotation.subtype === 'Highlight';
}

function getSelectionDedupeKey(selection) {
  const bbox = selection.bbox || {};
  return [
    selection.page ?? selection.pageNumber,
    (selection.text || '').replace(/\s+/g, ' ').trim().toLowerCase(),
    Math.round(Number(bbox.x0 ?? selection.x1 ?? 0)),
    Math.round(Number(bbox.y0 ?? selection.y1 ?? 0)),
    Math.round(Number(bbox.x1 ?? selection.x2 ?? 0)),
    Math.round(Number(bbox.y1 ?? 0)),
  ].join('|');
}

function dedupeMarkupSelections(selections = []) {
  const seen = new Set();
  return selections.filter(selection => {
    const key = getSelectionDedupeKey(selection);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeMarkupSelections(existingSelections = [], newSelections = []) {
  return dedupeMarkupSelections([
    ...(existingSelections || []),
    ...(newSelections || []),
  ]);
}

function updateEvidenceMarkupMetadata(evidenceObj, highlightedSelections, { replace = false } = {}) {
  if (!Array.isArray(highlightedSelections)) {
    return evidenceObj;
  }

  const extractedSelections = replace
    ? dedupeMarkupSelections(highlightedSelections)
    : mergeMarkupSelections(evidenceObj.extractedSelections, highlightedSelections);

  if (extractedSelections.length === 0) {
    const { extractedSelections: _removed, ...rest } = evidenceObj;
    return rest;
  }

  return { ...evidenceObj, extractedSelections };
}

async function extractHighlightsFromPdf(pdfSource) {
  const pdfBytes = await getPdfSourceBytes(pdfSource);
  const loadingTask = getDocument({ data: new Uint8Array(pdfBytes.slice(0)) });

  try {
    const pdfDoc = await loadingTask.promise;
    const highlightedSelections = [];

    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
      const page = await pdfDoc.getPage(pageNumber);
      const annotations = await page.getAnnotations({ intent: 'display' });
      const highlightAnnotations = annotations.filter(isHighlightAnnotation);
      if (highlightAnnotations.length === 0) continue;

      const viewport = page.getViewport({ scale: OCR_SCALE_FACTOR });
      const textContent = await page.getTextContent();
      const textItems = textContent.items
        .map((item, index) => ({
          index,
          str: item.str,
          rect: getTextItemViewportRect(item, viewport, textContent.styles),
        }))
        .filter(item => item.rect);

      for (const annotation of highlightAnnotations) {
        const rects = getAnnotationViewportRects(annotation, viewport);
        if (rects.length === 0) continue;

        const text = getTextForHighlightRects(textItems, rects);
        if (!text) continue;

        const bbox = combineRects(rects);
        highlightedSelections.push({
          page: pageNumber,
          pageNumber,
          text,
          x1: bbox.left,
          x2: bbox.right,
          y1: bbox.top,
          bbox: {
            x0: bbox.left,
            y0: bbox.top,
            x1: bbox.right,
            y1: bbox.bottom,
          },
          source: 'pdf-highlight',
          annotationId: annotation.id,
        });
      }
    }

    return dedupeMarkupSelections(highlightedSelections);
  } finally {
    await loadingTask.destroy();
  }
}

async function markupDocument(evidenceObj) {
  console.log("Markup document", { evidenceObj });
  let { extractedSelections, storageKey } = evidenceObj;
  
  // Always use the original PDF file, not the markup version
  const originalKey = storageKey.replace(/_markup\.pdf$/i, ".pdf");
  const pdfFile = await localforage.getItem(originalKey);  
  const pdfBytes = await pdfFile.arrayBuffer(); 
  const pdfData = new Uint8Array(pdfBytes.slice(0));

  const loadingTask = getDocument({ data: pdfData });
  let annotationCount = 0;

  try {
    const pdfDoc = await loadingTask.promise;

    for (const selection of extractedSelections || []) {
      console.log("Processing selection", selection);
      const { page, text, x1, x2, y1 } = selection;

      console.log("Markup selection", { page, text, x1, x2, y1 });

      // Page number is 1-indexed, but PDF.js pageIndex values are 0-indexed.
      const pageNumber = getSelectionPageNumber(selection);
      if (!Number.isInteger(pageNumber) || pageNumber <= 0 || pageNumber > pdfDoc.numPages) continue;

      const rect = getHighlightRectInOcrSpace(selection);
      if (!rect) continue;

      const currentPage = await pdfDoc.getPage(pageNumber);
      const viewport = currentPage.getViewport({ scale: OCR_SCALE_FACTOR });
      const quadPoints = viewportRectToPdfQuad(viewport, rect);
      const id = `pdfjs_internal_editor_${annotationCount++}`;

      pdfDoc.annotationStorage.setValue(id, createHighlightAnnotation({
        pageIndex: pageNumber - 1,
        rotation: currentPage.rotate || 0,
        quadPoints,
      }));
    }

    const modifiedPdfBytes = annotationCount > 0
      ? await pdfDoc.saveDocument()
      : pdfBytes;
    const newKey = originalKey.replace(/\.pdf$/i, "_markup.pdf");
    const newPdf = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    await localforage.setItem(newKey, newPdf);
    return newPdf;
  } finally {
    await loadingTask.destroy();
  }
}

export {
  extractHighlightsFromPdf,
  extractTextFromEvidence,
  markupDocument,
  updateEvidenceMarkupMetadata,
};
