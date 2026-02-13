import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

function normalizeAngle(angle = 0) {
  const a = angle % 360;
  return a < 0 ? a + 360 : a;
}

/**
 * Map a point from "viewer space" (after page rotation is applied) back into
 * the page's unrotated user space.
 *
 * Note: Per PDF spec, /Rotate is clockwise.
 */
function viewToUser({ vx, vy, W, H, rotateCW }) {
  switch (rotateCW) {
    case 0:
      return { ux: vx, uy: vy };
    case 90:
      // x_view = y, y_view = W - x  =>  y = x_view, x = W - y_view
      return { ux: W - vy, uy: vx };
    case 180:
      // x_view = W - x, y_view = H - y  =>  x = W - x_view, y = H - y_view
      return { ux: W - vx, uy: H - vy };
    case 270:
      // x_view = H - y, y_view = x  =>  x = y_view, y = H - x_view
      return { ux: vy, uy: H - vx };
    default:
      return { ux: vx, uy: vy };
  }
}

async function numberPages(pdfBytes, startNumber) {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  let pageNumber = startNumber;

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    const rotateCW = normalizeAngle(page.getRotation()?.angle ?? 0);

    // Use crop box if available (more likely to match what the viewer shows)
    const media = page.getSize();
    let box = { x: 0, y: 0, width: media.width, height: media.height };
    try {
      if (typeof page.getCropBox === 'function') {
        const crop = page.getCropBox();
        if (crop && Number.isFinite(crop.width) && Number.isFinite(crop.height)) {
          box = crop;
        }
      }
    } catch {
      // ignore and fall back to media box
    }

    const W = box.width;
    const H = box.height;

    const viewW = rotateCW === 90 || rotateCW === 270 ? H : W;
    const viewH = rotateCW === 90 || rotateCW === 270 ? W : H;

    const text = `Page ${pageNumber}`;
    const fontSize = 16;

    const paddingX = 6;
    const paddingY = 3;
    const borderWidth = 1;

    const marginBottom = Math.max(20, Math.round(viewH * 0.03));

    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const labelW = textWidth + paddingX * 2;
    const labelH = fontSize + paddingY * 2;

    // Label lower-left in VIEWER space (bottom-center)
    const vx = (viewW - labelW) / 2;
    const vy = marginBottom;

    // Map label origin VIEWER -> USER
    const { ux, uy } = viewToUser({ vx, vy, W, H, rotateCW });
    const x = box.x + ux;
    const y = box.y + uy;

    // IMPORTANT: compute text origin in VIEWER space, then map too
    // (so padding is "right/up" in the viewer, even on rotated pages)
    const insetX = paddingX + borderWidth; // keep text comfortably inside stroke
    const insetY = paddingY; // baseline padding; keep as-is unless you want vertical centering
    const { ux: uxText, uy: uyText } = viewToUser(
      { vx: vx + insetX, vy: vy + insetY, W, H, rotateCW },
    );
    const xText = box.x + uxText;
    const yText = box.y + uyText;

    const contentRotate = degrees(rotateCW);

    page.drawRectangle({
      x,
      y,
      width: labelW,
      height: labelH,
      rotate: contentRotate,
      color: rgb(1, 1, 1),
      borderColor: rgb(0, 0, 0),
      borderWidth,
    });

    page.drawText(text, {
      x: xText,
      y: yText,
      size: fontSize,
      color: rgb(0, 0, 0),
      font,
      rotate: contentRotate,
    });

    pageNumber++;
  }

  return await pdfDoc.save();
}

export default numberPages;
