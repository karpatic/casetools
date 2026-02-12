import { PDFDocument } from 'pdf-lib';

const A4 = { width: 595.28, height: 841.89 };

const isImageFile = (file) => {
  const name = (file?.name || '').toLowerCase();
  const type = (file?.type || '').toLowerCase();

  return (
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/png' ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png')
  );
};

const embedImage = async (pdfDoc, file) => {
  const bytes = await file.arrayBuffer();
  const type = (file?.type || '').toLowerCase();
  const lowerName = (file?.name || '').toLowerCase();

  if (type === 'image/png' || lowerName.endsWith('.png')) {
    return pdfDoc.embedPng(bytes);
  }

  return pdfDoc.embedJpg(bytes);
};

const drawEmbeddedImageA4Fit = (page, embeddedImage) => {
  const imgW = embeddedImage.width;
  const imgH = embeddedImage.height;

  const scale = Math.min(A4.width / imgW, A4.height / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const x = (A4.width - drawW) / 2;
  const y = (A4.height - drawH) / 2;

  page.drawImage(embeddedImage, { x, y, width: drawW, height: drawH });
};

const imageFileToA4PdfBlob = async (file) => {
  const pdfDoc = await PDFDocument.create();
  const embeddedImage = await embedImage(pdfDoc, file);
  const page = pdfDoc.addPage([A4.width, A4.height]);
  drawEmbeddedImageA4Fit(page, embeddedImage);

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
};

const imageFilesToA4PdfBlob = async (files, options = {}) => {
  const { sortByName = true } = options;

  const list = Array.isArray(files) ? [...files] : [];
  const imageFiles = list.filter(isImageFile);

  const sortedFiles = sortByName
    ? imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    : imageFiles;

  const pdfDoc = await PDFDocument.create();

  for (const file of sortedFiles) {
    const embeddedImage = await embedImage(pdfDoc, file);
    const page = pdfDoc.addPage([A4.width, A4.height]);
    drawEmbeddedImageA4Fit(page, embeddedImage);
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
};

export { isImageFile, imageFileToA4PdfBlob, imageFilesToA4PdfBlob };
