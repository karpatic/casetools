import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const LETTER = { width: 612, height: 792 };
const BLACK = rgb(0, 0, 0);

const FONT_PATHS = {
  regular: './rsc/fonts/LiberationSerif-Regular.ttf',
  bold: './rsc/fonts/LiberationSerif-Bold.ttf',
  italic: './rsc/fonts/LiberationSerif-Italic.ttf',
  boldItalic: './rsc/fonts/LiberationSerif-BoldItalic.ttf',
};

const fontBytesCache = new Map();

async function fetchFontBytes(path) {
  if (!fontBytesCache.has(path)) {
    fontBytesCache.set(path, fetch(path).then(async response => {
      if (!response.ok) {
        throw new Error(`Could not load packet font: ${path}`);
      }
      return response.arrayBuffer();
    }));
  }

  return fontBytesCache.get(path);
}

async function createDocumentContext({ marginLeft = 54, marginRight = 54, marginTop = 72, marginBottom = 72 } = {}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await Promise.all([
    fetchFontBytes(FONT_PATHS.regular),
    fetchFontBytes(FONT_PATHS.bold),
    fetchFontBytes(FONT_PATHS.italic),
    fetchFontBytes(FONT_PATHS.boldItalic),
  ]);

  const [regular, bold, italic, boldItalic] = await Promise.all(
    fontBytes.map(bytes => pdfDoc.embedFont(bytes, { subset: true })),
  );

  const ctx = {
    pdfDoc,
    page: null,
    fonts: { regular, bold, italic, boldItalic },
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    contentWidth: LETTER.width - marginLeft - marginRight,
    y: LETTER.height - marginTop,
    addPage() {
      this.page = this.pdfDoc.addPage([LETTER.width, LETTER.height]);
      this.y = LETTER.height - this.marginTop;
      return this.page;
    },
  };

  ctx.addPage();
  return ctx;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\u00A0/g, ' ');
}

function oneLine(value) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function textWidth(text, font, size) {
  return font.widthOfTextAtSize(normalizeText(text), size);
}

function splitLongToken(token, font, size, maxWidth) {
  const chunks = [];
  let chunk = '';

  for (const char of Array.from(normalizeText(token))) {
    const candidate = chunk + char;
    if (chunk && textWidth(candidate, font, size) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = candidate;
    }
  }

  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [''];
}

function wrapText(value, font, size, maxWidth) {
  const normalized = normalizeText(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = [];

  for (const paragraph of normalized.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (lines.length) lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      if (textWidth(word, font, size) > maxWidth) {
        const chunks = splitLongToken(word, font, size, maxWidth);
        if (line) {
          lines.push(line);
          line = '';
        }

        for (let i = 0; i < chunks.length; i++) {
          if (i === chunks.length - 1) {
            line = chunks[i];
          } else {
            lines.push(chunks[i]);
          }
        }
        continue;
      }

      const candidate = line ? `${line} ${word}` : word;
      if (!line || textWidth(candidate, font, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }

    if (line) lines.push(line);
  }

  return lines.length ? lines : [''];
}

function drawLine(page, x1, y1, x2, y2, thickness = 0.75) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: BLACK,
  });
}

function drawAlignedLine(page, line, { x, y, width, font, size, align = 'left', underline = false }) {
  const normalized = normalizeText(line);
  if (!normalized) return;

  const widthOfLine = textWidth(normalized, font, size);
  let drawX = x;
  if (align === 'center') {
    drawX = x + Math.max(0, (width - widthOfLine) / 2);
  } else if (align === 'right') {
    drawX = x + Math.max(0, width - widthOfLine);
  }

  page.drawText(normalized, { x: drawX, y, size, font, color: BLACK });
  if (underline) {
    drawLine(page, drawX, y - 2, drawX + widthOfLine, y - 2, 0.5);
  }
}

function drawWrappedText(page, value, { x, y, width, font, size, lineHeight, align = 'left', underline = false }) {
  const lines = wrapText(value, font, size, width);
  lines.forEach((line, index) => {
    drawAlignedLine(page, line, {
      x,
      y: y - (index * lineHeight),
      width,
      font,
      size,
      align,
      underline,
    });
  });

  return y - (lines.length * lineHeight);
}

function drawFlowSegments(page, segments, { x, y, width, font, size, lineHeight }) {
  const maxX = x + width;
  let cursorX = x;
  let cursorY = y;

  const newLine = () => {
    cursorX = x;
    cursorY -= lineHeight;
  };

  const drawToken = token => {
    if (token.blankWidth) {
      const blankWidth = Math.min(token.blankWidth, width);
      if (cursorX !== x && cursorX + blankWidth > maxX) newLine();
      drawLine(page, cursorX, cursorY - 2, cursorX + blankWidth, cursorY - 2, 0.5);
      cursorX += blankWidth;
      return;
    }

    const tokenFont = token.font || font;
    const tokenText = normalizeText(token.text);
    if (!tokenText) return;

    if (/^\s+$/.test(tokenText)) {
      if (cursorX === x) return;
      const spaceWidth = textWidth(' ', tokenFont, size);
      if (cursorX + spaceWidth > maxX) {
        newLine();
      } else {
        cursorX += spaceWidth;
      }
      return;
    }

    const pieces = textWidth(tokenText, tokenFont, size) > width
      ? splitLongToken(tokenText, tokenFont, size, width)
      : [tokenText];

    pieces.forEach((piece, index) => {
      const pieceWidth = textWidth(piece, tokenFont, size);
      if (cursorX !== x && cursorX + pieceWidth > maxX) newLine();
      page.drawText(piece, { x: cursorX, y: cursorY, size, font: tokenFont, color: BLACK });
      if (token.underline) {
        drawLine(page, cursorX, cursorY - 2, cursorX + pieceWidth, cursorY - 2, 0.5);
      }
      cursorX += pieceWidth;
      if (index < pieces.length - 1) newLine();
    });
  };

  segments.forEach(segment => {
    if (segment.blankWidth) {
      drawToken(segment);
      return;
    }

    const parts = normalizeText(segment.text).replace(/\s+/g, ' ').split(/(\s+)/);
    parts.forEach(part => drawToken({
      text: part,
      font: segment.font,
      underline: segment.underline,
    }));
  });

  return cursorY - lineHeight;
}

function caseData(config = {}, packetConfig = {}) {
  const respondents = Array.isArray(config.respondents) ? config.respondents : [];

  return {
    attorney: {
      name: oneLine(config.attorney?.attorney_name),
      address: oneLine(config.attorney?.address),
      city: oneLine(config.attorney?.city),
      phone: oneLine(config.attorney?.phone),
      email: oneLine(config.attorney?.email),
      eoirId: oneLine(config.attorney?.eoir_id),
      caseType: oneLine(config.attorney?.case_type),
    },
    cover: {
      department: oneLine(config.cover?.cover_department),
      division: oneLine(config.cover?.cover_division),
      name: oneLine(config.cover?.cover_name),
      location: oneLine(config.cover?.cover_location),
    },
    certificate: {
      department: oneLine(config.certificate?.certificate_department),
      division: oneLine(config.certificate?.certificate_division),
      name: oneLine(config.certificate?.certificate_name),
      address: oneLine(config.certificate?.certificate_location_address),
      lineTwo: oneLine(config.certificate?.certificate_location_linetwo),
      stateZip: oneLine(config.certificate?.certificate_location_statezip),
    },
    respondents: respondents.map(respondent => ({
      fullName: oneLine(respondent.full_name),
      fileNumbers: Array.isArray(respondent.file_numbers)
        ? respondent.file_numbers.map(oneLine).filter(Boolean)
        : [],
      status: oneLine(respondent.status),
    })),
    judge: {
      name: oneLine(config.judge?.judge_name),
      hearingDate: oneLine(config.judge?.hearing_date),
      hearingTime: oneLine(config.judge?.hearing_time),
    },
    document: {
      title: oneLine(packetConfig.packetTitle),
      multipleRespondents: respondents.length > 1,
    },
  };
}

function drawCourtBlock(page, data, fonts, { x, y, width, size = 12, lineHeight = 14 }) {
  let cursorY = y;
  [data.cover.department, data.cover.division, data.cover.name, data.cover.location].forEach(line => {
    cursorY = drawWrappedText(page, line, {
      x,
      y: cursorY,
      width,
      font: fonts.bold,
      size,
      lineHeight,
      align: 'center',
    });
  });
  return cursorY;
}

function drawAttorneyBlock(page, data, fonts, { x, y, width }) {
  const size = 12;
  const lineHeight = 14;
  let cursorY = y;
  const caseTypeWidth = data.attorney.caseType ? textWidth(data.attorney.caseType, fonts.bold, size) : 0;
  const nameWidth = Math.max(width * 0.55, width - caseTypeWidth - 18);

  drawAlignedLine(page, data.attorney.caseType, {
    x,
    y: cursorY,
    width,
    font: fonts.bold,
    size,
    align: 'right',
  });
  cursorY = drawWrappedText(page, data.attorney.name, {
    x,
    y: cursorY,
    width: nameWidth,
    font: fonts.bold,
    size,
    lineHeight,
  });

  [
    data.attorney.address,
    data.attorney.city,
    data.attorney.phone ? `Telephone ${data.attorney.phone}` : '',
    data.attorney.email,
    data.attorney.eoirId ? `EOIR ID# ${data.attorney.eoirId}` : '',
  ].forEach(line => {
    cursorY = drawWrappedText(page, line, {
      x,
      y: cursorY,
      width,
      font: fonts.bold,
      size,
      lineHeight,
    });
  });

  return drawWrappedText(page, data.document.multipleRespondents ? 'Attorney for Respondents' : 'Attorney for Respondent', {
    x,
    y: cursorY,
    width,
    font: fonts.italic,
    size,
    lineHeight,
  });
}

function respondentFileLines(respondent) {
  return respondent.fileNumbers.length ? respondent.fileNumbers : [''];
}

function drawCaptionBlock(page, data, fonts, { x, y, width, size = 12, lineHeight = 14 }) {
  const halfWidth = width * 0.5;
  const columnGap = 14;
  const leftWidth = halfWidth - columnGap;
  const rightX = x + halfWidth + columnGap;
  const rightWidth = width - halfWidth - columnGap;

  drawLine(page, x, y, x + halfWidth, y, 0.75);
  let cursorY = y - 18;
  const tableTop = cursorY + 9;

  drawAlignedLine(page, 'In the Matter of:', {
    x,
    y: cursorY,
    width: leftWidth,
    font: fonts.bold,
    size,
  });

  if (data.document.multipleRespondents) {
    drawAlignedLine(page, 'File No.:', {
      x: rightX,
      y: cursorY,
      width: rightWidth,
      font: fonts.bold,
      size,
    });
  }

  cursorY -= lineHeight * 1.6;

  data.respondents.forEach((respondent, index) => {
    const nameLines = wrapText(respondent.fullName, fonts.bold, size, leftWidth);
    const fileLines = respondentFileLines(respondent).flatMap(fileNumber => wrapText(fileNumber, fonts.bold, size, rightWidth));
    const rowLines = Math.max(nameLines.length, fileLines.length, 1);

    for (let i = 0; i < rowLines; i++) {
      if (nameLines[i]) {
        drawAlignedLine(page, nameLines[i], {
          x,
          y: cursorY - (i * lineHeight),
          width: leftWidth,
          font: fonts.bold,
          size,
        });
      }
      if (fileLines[i]) {
        drawAlignedLine(page, fileLines[i], {
          x: rightX,
          y: cursorY - (i * lineHeight),
          width: rightWidth,
          font: fonts.bold,
          size,
        });
      }
    }

    cursorY -= rowLines * lineHeight;

    if (respondent.status) {
      cursorY -= 2;
      cursorY = drawWrappedText(page, data.document.multipleRespondents ? 'Respondents' : 'Respondent', {
        x,
        y: cursorY,
        width: leftWidth,
        font: fonts.boldItalic,
        size,
        lineHeight,
      });
      cursorY = drawWrappedText(page, respondent.status, {
        x,
        y: cursorY,
        width: leftWidth,
        font: fonts.bold,
        size,
        lineHeight,
      });
    }

    if (index < data.respondents.length - 1) cursorY -= 6;
  });

  const tableBottom = cursorY + 7;
  drawLine(page, x + halfWidth, tableTop, x + halfWidth, tableBottom, 0.75);
  drawLine(page, x, tableBottom, x + halfWidth, tableBottom, 0.75);
  return cursorY - 18;
}

function drawJudgeBlock(page, data, fonts, { x, y, width }) {
  const size = 12;
  const lineHeight = 14;
  const leftWidth = width * 0.42;
  const rightWidth = width - leftWidth - 12;
  const hearing = [data.judge.hearingDate, data.judge.hearingTime].filter(Boolean).join(' at ');

  const leftY = drawWrappedText(page, `Judge: ${data.judge.name}`, {
    x,
    y,
    width: leftWidth,
    font: fonts.bold,
    size,
    lineHeight,
  });
  const rightY = drawWrappedText(page, `Next Hearing: ${hearing}`, {
    x: x + leftWidth + 12,
    y,
    width: rightWidth,
    font: fonts.bold,
    size,
    lineHeight,
    align: 'right',
  });

  return Math.min(leftY, rightY);
}

function drawCenteredUnderlinedTitle(page, title, fonts, { x, y, width, size, lineHeight }) {
  const nextY = drawWrappedText(page, title, {
    x,
    y,
    width,
    font: fonts.bold,
    size,
    lineHeight,
    align: 'center',
  });

  const titleWidth = Math.min(width, textWidth(title, fonts.bold, size));
  const ruleX = x + ((width - titleWidth) / 2);
  drawLine(page, ruleX, y - 4, ruleX + titleWidth, y - 4, 0.5);
  return nextY;
}

function ensureTocSpace(ctx, height) {
  if (ctx.y - height >= ctx.marginBottom) return;
  ctx.addPage();
  drawTocHeader(ctx);
}

function drawCellBorder(page, x, topY, width, height) {
  page.drawRectangle({
    x,
    y: topY - height,
    width,
    height,
    borderColor: BLACK,
    borderWidth: 0.75,
  });
}

function drawCellText(page, lines, { x, topY, width, padding, font, size, lineHeight, align }) {
  lines.forEach((line, index) => {
    drawAlignedLine(page, line, {
      x: x + padding,
      y: topY - padding - size - (index * lineHeight),
      width: width - (padding * 2),
      font,
      size,
      align,
    });
  });
}

function drawTocHeader(ctx) {
  const { page, fonts, marginLeft, contentWidth } = ctx;
  const tabWidth = 58;
  const pageWidth = 82;
  const descWidth = contentWidth - tabWidth - pageWidth;
  const topY = ctx.y;
  const height = 30;
  const size = 14;
  const lineHeight = 18;
  const padding = 5;

  drawCellBorder(page, marginLeft, topY, tabWidth, height);
  drawCellBorder(page, marginLeft + tabWidth, topY, descWidth, height);
  drawCellBorder(page, marginLeft + tabWidth + descWidth, topY, pageWidth, height);

  drawCellText(page, ['TAB'], {
    x: marginLeft,
    topY,
    width: tabWidth,
    padding,
    font: fonts.bold,
    size,
    lineHeight,
    align: 'center',
  });
  drawCellText(page, ['DESCRIPTION OF EXHIBIT'], {
    x: marginLeft + tabWidth,
    topY,
    width: descWidth,
    padding,
    font: fonts.bold,
    size,
    lineHeight,
    align: 'center',
  });
  drawCellText(page, ['PAGE(S)'], {
    x: marginLeft + tabWidth + descWidth,
    topY,
    width: pageWidth,
    padding,
    font: fonts.bold,
    size,
    lineHeight,
    align: 'center',
  });

  ctx.y -= height;
}

function drawTocRow(ctx, exhibit) {
  const { fonts, marginLeft, contentWidth } = ctx;
  const tabWidth = 58;
  const pageWidth = 82;
  const descWidth = contentWidth - tabWidth - pageWidth;
  const rowSize = 14;
  const lineHeight = 20;
  const padding = 6;
  const descLines = wrapText(exhibit.title, fonts.regular, rowSize, descWidth - (padding * 2));
  const tabLines = wrapText(exhibit.letter, fonts.bold, rowSize, tabWidth - (padding * 2));
  const pageLines = wrapText(exhibit.pageRange, fonts.regular, rowSize, pageWidth - (padding * 2));

  let descIndex = 0;
  let firstChunk = true;

  while (descIndex < descLines.length || firstChunk) {
    if (ctx.y - (padding * 2 + lineHeight) < ctx.marginBottom) {
      ctx.addPage();
      drawTocHeader(ctx);
    }

    const availableLines = Math.max(1, Math.floor((ctx.y - ctx.marginBottom - (padding * 2)) / lineHeight));
    const descChunk = descLines.slice(descIndex, descIndex + availableLines);
    const leftLines = firstChunk ? tabLines : [''];
    const rightLines = firstChunk ? pageLines : [''];
    const rowLines = Math.max(descChunk.length, leftLines.length, rightLines.length, 1);
    const height = (rowLines * lineHeight) + (padding * 2);

    ensureTocSpace(ctx, height);

    const topY = ctx.y;
    const currentPage = ctx.page;
    drawCellBorder(currentPage, marginLeft, topY, tabWidth, height);
    drawCellBorder(currentPage, marginLeft + tabWidth, topY, descWidth, height);
    drawCellBorder(currentPage, marginLeft + tabWidth + descWidth, topY, pageWidth, height);

    drawCellText(currentPage, leftLines, {
      x: marginLeft,
      topY,
      width: tabWidth,
      padding,
      font: fonts.bold,
      size: rowSize,
      lineHeight,
      align: 'center',
    });
    drawCellText(currentPage, descChunk.length ? descChunk : [''], {
      x: marginLeft + tabWidth,
      topY,
      width: descWidth,
      padding,
      font: fonts.regular,
      size: rowSize,
      lineHeight,
      align: 'left',
    });
    drawCellText(currentPage, rightLines, {
      x: marginLeft + tabWidth + descWidth,
      topY,
      width: pageWidth,
      padding,
      font: fonts.regular,
      size: rowSize,
      lineHeight,
      align: 'right',
    });

    ctx.y -= height;
    descIndex += descChunk.length || 1;
    firstChunk = false;
  }
}

function drawRespondentCertificateHeader(page, data, fonts, { x, y, width }) {
  const size = 12;
  const lineHeight = 16;
  const leftWidth = width * 0.58;
  const rightWidth = width - leftWidth - 12;
  let cursorY = y;

  data.respondents.forEach(respondent => {
    const fileNumbers = respondentFileLines(respondent);
    const nameLines = wrapText(respondent.fullName, fonts.bold, size, leftWidth);
    const firstFileLines = wrapText(fileNumbers[0] || '', fonts.bold, size, rightWidth);
    const rowLines = Math.max(nameLines.length, firstFileLines.length, 1);

    for (let i = 0; i < rowLines; i++) {
      if (nameLines[i]) {
        drawAlignedLine(page, nameLines[i], {
          x,
          y: cursorY - (i * lineHeight),
          width: leftWidth,
          font: fonts.bold,
          size,
        });
      }
      if (firstFileLines[i]) {
        drawAlignedLine(page, firstFileLines[i], {
          x: x + leftWidth + 12,
          y: cursorY - (i * lineHeight),
          width: rightWidth,
          font: fonts.bold,
          size,
          align: 'right',
        });
      }
    }

    cursorY -= rowLines * lineHeight;

    fileNumbers.slice(1).forEach(fileNumber => {
      const lines = wrapText(fileNumber, fonts.bold, size, rightWidth);
      lines.forEach((line, index) => {
        drawAlignedLine(page, line, {
          x: x + leftWidth + 12,
          y: cursorY - (index * lineHeight),
          width: rightWidth,
          font: fonts.bold,
          size,
          align: 'right',
        });
      });
      cursorY -= lines.length * lineHeight;
    });
  });

  return cursorY;
}

function drawCertificateAddressLine(page, value, fonts, { x, y, width }) {
  const lineText = oneLine(value);
  if (!lineText) {
    drawLine(page, x, y - 2, x + Math.min(220, width), y - 2, 0.5);
    return y - 18;
  }

  return drawWrappedText(page, lineText, {
    x,
    y,
    width,
    font: fonts.regular,
    size: 12,
    lineHeight: 18,
    underline: true,
  });
}

export async function createCoverPdfBytes(config, packetConfig) {
  const data = caseData(config, packetConfig);
  const ctx = await createDocumentContext({
    marginLeft: 54,
    marginRight: 54,
    marginTop: 18,
    marginBottom: 18,
  });
  const { page, fonts, marginLeft, contentWidth } = ctx;
  let y = ctx.y;

  y = drawAttorneyBlock(page, data, fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
  });
  y -= 28;

  y = drawCourtBlock(page, data, fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
  });
  y -= 28;

  y = drawCaptionBlock(page, data, fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
  });
  y -= 14;

  y = drawJudgeBlock(page, data, fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
  });
  y -= 34;

  drawWrappedText(page, data.document.title, {
    x: marginLeft,
    y,
    width: contentWidth,
    font: fonts.bold,
    size: 12,
    lineHeight: 14,
    align: 'center',
  });

  return ctx.pdfDoc.save();
}

export async function createTableOfContentsPdfBytes(config, contents, packetConfig) {
  const data = caseData(config, packetConfig);
  const ctx = await createDocumentContext({
    marginLeft: 54,
    marginRight: 54,
    marginTop: 72,
    marginBottom: 72,
  });
  const { page, fonts, marginLeft, contentWidth } = ctx;
  let y = ctx.y;

  y = drawCourtBlock(page, data, fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
  });
  y -= 30;

  y = drawCaptionBlock(page, data, fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
  });
  y -= 16;

  y = drawCenteredUnderlinedTitle(page, 'TABLE OF CONTENTS', fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
    size: 20,
    lineHeight: 22,
  });
  y -= 24;

  ctx.y = y;
  drawTocHeader(ctx);

  contents.forEach(exhibit => drawTocRow(ctx, {
    letter: oneLine(exhibit.letter),
    title: oneLine(exhibit.title),
    pageRange: oneLine(exhibit.pageRange),
  }));

  return ctx.pdfDoc.save();
}

export async function createCertificatePdfBytes(config, packetConfig) {
  const data = caseData(config, packetConfig);
  const ctx = await createDocumentContext({
    marginLeft: 72,
    marginRight: 72,
    marginTop: 72,
    marginBottom: 72,
  });
  const { page, fonts, marginLeft, contentWidth } = ctx;
  let y = ctx.y;

  y = drawRespondentCertificateHeader(page, data, fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
  });
  y -= 30;

  y = drawCenteredUnderlinedTitle(page, 'CERTIFICATE OF SERVICE', fonts, {
    x: marginLeft,
    y,
    width: contentWidth,
    size: 16,
    lineHeight: 18,
  });
  y -= 38;

  y = drawFlowSegments(page, [
    { text: 'On ' },
    { blankWidth: 85 },
    { text: ', I, ' },
    { blankWidth: 250 },
    { text: ', served a copy of this ' },
    { text: data.document.title, underline: true },
    { text: ' and any attached pages to the Department of Homeland Security, Immigration and Customs Enforcement, Office of the Principal Legal Advisor at:' },
  ], {
    x: marginLeft,
    y,
    width: contentWidth,
    font: fonts.regular,
    size: 12,
    lineHeight: 18,
  });
  y -= 16;

  const addressX = marginLeft + 24;
  const addressWidth = contentWidth - 24;
  [
    data.certificate.department,
    data.certificate.division,
    data.certificate.name,
    data.certificate.address,
    data.certificate.lineTwo,
    data.certificate.stateZip,
  ].forEach(line => {
    y = drawCertificateAddressLine(page, line, fonts, {
      x: addressX,
      y,
      width: addressWidth,
    });
  });
  y -= 34;

  y = drawFlowSegments(page, [
    { text: 'By ' },
    { text: 'EOIR Case Portal, E-ROP.', underline: true },
  ], {
    x: marginLeft,
    y,
    width: contentWidth,
    font: fonts.regular,
    size: 12,
    lineHeight: 18,
  });
  y -= 66;

  const signatureWidth = contentWidth * 0.45;
  drawLine(page, marginLeft, y, marginLeft + signatureWidth, y, 0.75);
  drawLine(page, marginLeft + contentWidth - signatureWidth, y, marginLeft + contentWidth, y, 0.75);
  y -= 16;
  drawAlignedLine(page, data.attorney.name, {
    x: marginLeft,
    y,
    width: signatureWidth,
    font: fonts.bold,
    size: 12,
  });
  drawAlignedLine(page, 'Date', {
    x: marginLeft + contentWidth - signatureWidth,
    y,
    width: signatureWidth,
    font: fonts.bold,
    size: 12,
    align: 'right',
  });

  return ctx.pdfDoc.save();
}
