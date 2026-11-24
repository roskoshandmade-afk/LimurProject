import { jsPDF } from 'jspdf';

const LOGO_VIEW_W = 216;
const LOGO_VIEW_H = 84;
export const LIMUR_LOGO_ASPECT = LOGO_VIEW_W / LOGO_VIEW_H;

let cachedLogoPngDataUrl: string | null = null;
let cachedFontSignature = '';

function drawJustifiedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  targetWidth: number,
  horizontalScale = 1
): void {
  const chars = Array.from(text);
  if (chars.length === 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(horizontalScale, 1);

  const scaledTargetW = targetWidth / horizontalScale;
  if (chars.length === 1) {
    ctx.fillText(chars[0], 0, 0);
    ctx.restore();
    return;
  }

  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalGlyphW = widths.reduce((sum, w) => sum + w, 0);
  const extraSpace = Math.max(0, scaledTargetW - totalGlyphW);
  const gap = extraSpace / (chars.length - 1);

  let cursorX = 0;
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, cursorX, 0);
    cursorX += widths[idx] + gap;
  });

  ctx.restore();
}

async function renderLimurLogoHighResPng(): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  try {
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 400)),
      ]);
    }
  } catch {
    // Continue with available fonts
  }

  const hasOswald =
    typeof document.fonts?.check === 'function' && document.fonts.check('500 44px "Oswald"');
  const hasBarlow =
    typeof document.fonts?.check === 'function' &&
    document.fonts.check('500 44px "Barlow Condensed"');

  const fontSig = hasOswald ? 'oswald' : hasBarlow ? 'barlow' : 'fallback';
  if (cachedLogoPngDataUrl && cachedFontSignature === fontSig) {
    return cachedLogoPngDataUrl;
  }

  try {
    // Render at 5x logical resolution (1080 x 420 px -> >600 DPI at 42mm PDF width)
    const scale = 5;
    const canvas = document.createElement('canvas');
    canvas.width = LOGO_VIEW_W * scale;
    canvas.height = LOGO_VIEW_H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);

    // Solid crisp white interior
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, LOGO_VIEW_W, LOGO_VIEW_H);

    // Sharp rectangular border (no rounded corners)
    ctx.strokeStyle = '#0A0A0A';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, LOGO_VIEW_W - 2, LOGO_VIEW_H - 2);

    const fontFamily = hasOswald
      ? '"Oswald", sans-serif'
      : hasBarlow
      ? '"Barlow Condensed", sans-serif'
      : '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';

    // If neither condensed webfont is loaded (e.g. cold offline launch),
    // horizontally condense fallback glyphs to preserve exact architectural proportions.
    const condenseX = hasOswald || hasBarlow ? 1 : 0.72;

    ctx.fillStyle = '#0A0A0A';
    ctx.textBaseline = 'alphabetic';

    // Top row: LI . MUR
    ctx.font = `500 44px ${fontFamily}`;
    drawJustifiedText(ctx, 'LI', 22, 50, 44, condenseX);

    // Crisp circular baseline dot between I and M
    ctx.beginPath();
    ctx.arc(75.5, 46.8, 3.2, 0, Math.PI * 2);
    ctx.fill();

    drawJustifiedText(ctx, 'MUR', 85, 50, 109, condenseX);

    // Bottom row: PROJECT flush-aligned to exact width of LI.MUR (x = 22..194)
    ctx.font = `500 14.5px ${fontFamily}`;
    drawJustifiedText(ctx, 'PROJECT', 22, 69, 172, condenseX);

    const dataUrl = canvas.toDataURL('image/png');
    cachedLogoPngDataUrl = dataUrl;
    cachedFontSignature = fontSig;
    return dataUrl;
  } catch {
    return null;
  }
}

function drawLimurLogoVectorFallback(
  doc: jsPDF,
  x: number,
  y: number,
  widthMm: number,
  heightMm: number
): void {
  const scale = widthMm / LOGO_VIEW_W;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(Math.max(0.35, 2 * scale));
  doc.rect(x, y, widthMm, heightMm, 'FD');

  doc.setTextColor(10, 10, 10);
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(Math.max(9, widthMm * 0.34));
  doc.text('LI', x + 22 * scale, y + 50 * scale);

  doc.setFillColor(10, 10, 10);
  doc.circle(x + 75.5 * scale, y + 46.8 * scale, 3.2 * scale, 'F');

  doc.text('MUR', x + 85 * scale, y + 50 * scale);

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(Math.max(5.5, widthMm * 0.13));
  const letters = ['P', 'R', 'O', 'J', 'E', 'C', 'T'];
  const startX = x + 22 * scale;
  const spanW = 166 * scale;
  const step = spanW / (letters.length - 1);
  letters.forEach((ch, idx) => {
    doc.text(ch, startX + idx * step, y + 69 * scale);
  });
}

/**
 * Draws the official rectangular LI.MUR / PROJECT logo into any jsPDF document.
 * Uses a >600 DPI offscreen canvas render (with guaranteed condensed proportions)
 * and falls back cleanly to pure PDF vector primitives if canvas is unavailable.
 */
export async function drawLimurLogoPdf(
  doc: jsPDF,
  x: number,
  y: number,
  widthMm: number
): Promise<{ widthMm: number; heightMm: number }> {
  const heightMm = widthMm / LIMUR_LOGO_ASPECT;
  const pngDataUrl = await renderLimurLogoHighResPng();

  if (pngDataUrl) {
    doc.addImage(pngDataUrl, 'PNG', x, y, widthMm, heightMm, 'limur_logo_mark', 'FAST');
  } else {
    drawLimurLogoVectorFallback(doc, x, y, widthMm, heightMm);
  }

  return { widthMm, heightMm };
}
