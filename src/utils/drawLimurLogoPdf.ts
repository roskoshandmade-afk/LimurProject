import { jsPDF } from 'jspdf';
import {
  CALLIGRAPHY_HEART_PATH,
  CALLIGRAPHY_SCRIPT_PATH,
  LIMUR_LOGO_VIEWBOX_H,
} from '../components/LimurLogo';

// Tight artwork horizontal crop within the 320x190 canonical SVG viewBox
// so the left tip of «твой» aligns flush with PDF left margins.
const CROP_X = 38;
const CROP_W = 246;
const CROP_H = LIMUR_LOGO_VIEWBOX_H; // 190

export const LIMUR_LOGO_ASPECT = CROP_W / CROP_H;

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
  if (totalGlyphW > scaledTargetW && totalGlyphW > 0) {
    // Fit tightly if fallback font glyphs are wider than target box
    const fitScale = scaledTargetW / totalGlyphW;
    ctx.scale(fitScale, 1);
    let cursorX = 0;
    chars.forEach((ch, idx) => {
      ctx.fillText(ch, cursorX, 0);
      cursorX += widths[idx];
    });
    ctx.restore();
    return;
  }

  const extraSpace = Math.max(0, scaledTargetW - totalGlyphW);
  const gap = extraSpace / (chars.length - 1);

  let cursorX = 0;
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, cursorX, 0);
    cursorX += widths[idx] + gap;
  });

  ctx.restore();
}

/**
 * Renders the canonical full vector LI.MUR PROJECT — «твой интерьер» logo
 * into a transparent high-resolution PNG (>600 DPI at typical 30-45mm PDF widths).
 */
export async function renderLimurLogoTransparentPng(): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  try {
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ]);
    }
  } catch {
    // Proceed with available fonts
  }

  const hasOswald =
    typeof document.fonts?.check === 'function' && document.fonts.check('500 82px "Oswald"');
  const hasBarlow =
    typeof document.fonts?.check === 'function' &&
    document.fonts.check('500 82px "Barlow Condensed"');

  const fontSig = hasOswald ? 'oswald' : hasBarlow ? 'barlow' : 'fallback';
  if (cachedLogoPngDataUrl && cachedFontSignature === fontSig) {
    return cachedLogoPngDataUrl;
  }

  try {
    // 6x scale (1476 x 1140 px -> >900 DPI at 38mm PDF width, strictly >300 DPI at any A4 size)
    const scale = 6;
    const canvas = document.createElement('canvas');
    canvas.width = CROP_W * scale;
    canvas.height = CROP_H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Keep canvas background 100% transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-CROP_X, 0);

    // 1. Sharp rectangular architectural frame (transparent interior)
    ctx.strokeStyle = '#0A0A0A';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(70.3, 3, 179.4, 131.7);

    // 2. Condensed architectural typography inside frame
    const fontFamily = hasOswald
      ? '"Oswald", sans-serif'
      : hasBarlow
      ? '"Barlow Condensed", sans-serif'
      : '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';

    const condenseX = hasOswald || hasBarlow ? 1 : 0.68;

    ctx.fillStyle = '#0A0A0A';
    ctx.textBaseline = 'alphabetic';

    // Row 1: LI . MUR
    ctx.font = `500 82px ${fontFamily}`;
    drawJustifiedText(ctx, 'LI', 85.8, 75.3, 32, condenseX);

    ctx.beginPath();
    ctx.arc(132.2, 71.6, 4.3, 0, Math.PI * 2);
    ctx.fill();

    drawJustifiedText(ctx, 'MUR', 146.8, 75.3, 89.5, condenseX);

    // Row 2: PROJECT flush-aligned beneath LI.MUR
    ctx.font = `500 48px ${fontFamily}`;
    drawJustifiedText(ctx, 'PROJECT', 85.8, 122.6, 150.5, condenseX);

    // 3. Calligraphic script «твой интерьер» (with «в» loop crossing frame bottom) + black heart
    if (typeof Path2D !== 'undefined') {
      const scriptPath = new Path2D(CALLIGRAPHY_SCRIPT_PATH);
      ctx.fill(scriptPath, 'evenodd');

      const heartPath = new Path2D(CALLIGRAPHY_HEART_PATH);
      ctx.fill(heartPath);
    }

    ctx.restore();

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
  widthMm: number
): void {
  const scale = widthMm / CROP_W;
  const ox = x - CROP_X * scale;

  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(Math.max(0.35, 2.5 * scale));
  doc.rect(ox + 70.3 * scale, y + 3 * scale, 179.4 * scale, 131.7 * scale, 'S');

  doc.setTextColor(10, 10, 10);
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(Math.max(11, widthMm * 0.45));
  doc.text('LI', ox + 85.8 * scale, y + 75.3 * scale);

  doc.setFillColor(10, 10, 10);
  doc.circle(ox + 132.2 * scale, y + 71.6 * scale, 4.3 * scale, 'F');

  doc.text('MUR', ox + 146.8 * scale, y + 75.3 * scale);

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(Math.max(7, widthMm * 0.24));
  const letters = ['P', 'R', 'O', 'J', 'E', 'C', 'T'];
  const startX = ox + 85.8 * scale;
  const spanW = 144 * scale;
  const step = spanW / (letters.length - 1);
  letters.forEach((ch, idx) => {
    doc.text(ch, startX + idx * step, y + 122.6 * scale);
  });

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(Math.max(6.5, widthMm * 0.2));
  doc.text('твой интерьер', ox + 160 * scale, y + 162 * scale, { align: 'center' });
}

/**
 * Draws the official full LI.MUR PROJECT — «твой интерьер» logo into any jsPDF document.
 * Uses a transparent >300 DPI PNG rendered from the canonical SVG paths & typography,
 * falling back cleanly to native PDF vector primitives if canvas is unavailable.
 */
export async function drawLimurLogoPdf(
  doc: jsPDF,
  x: number,
  y: number,
  widthMm: number
): Promise<{ widthMm: number; heightMm: number }> {
  const heightMm = widthMm / LIMUR_LOGO_ASPECT;
  const pngDataUrl = await renderLimurLogoTransparentPng();

  if (pngDataUrl) {
    doc.addImage(pngDataUrl, 'PNG', x, y, widthMm, heightMm, 'limur_full_logo_mark', 'FAST');
  } else {
    drawLimurLogoVectorFallback(doc, x, y, widthMm);
  }

  return { widthMm, heightMm };
}
