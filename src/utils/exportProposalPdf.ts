import { jsPDF } from 'jspdf';
import liberationRegularUrl from '../assets/fonts/LiberationSans-Regular.ttf';
import liberationBoldUrl from '../assets/fonts/LiberationSans-Bold.ttf';
import monoRegularUrl from '../assets/fonts/JetBrainsMono-Regular.ttf';
import monoBoldUrl from '../assets/fonts/JetBrainsMono-Bold.ttf';
import { CommercialProposal } from '../types';
import { formatCurrency, formatDate } from './calculations';
import { drawLimurLogoPdf } from './drawLimurLogoPdf';

export interface ProposalPdfPaymentRow {
  key: string;
  label: string;
  percentLabel: string;
  workingDays: string;
  amount: number;
  isAdvance?: boolean;
}

export interface ProposalPdfCalculation {
  safeArea: number;
  baseTotal: number;
  finalTotal: number;
  discountAmount: number;
  discountPercent: number;
  effectiveAdvance: number;
  advanceExceedsStage1: boolean;
  totalWorkingDays: number;
  rows: ProposalPdfPaymentRow[];
}

export interface ExportProposalPdfParams {
  proposal: CommercialProposal;
  packageTitle: string;
  calc: ProposalPdfCalculation;
}

interface LoadedFonts {
  sansRegular: string;
  sansBold: string;
  monoRegular: string;
  monoBold: string;
}

let cachedFonts: LoadedFonts | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не удалось загрузить локальный шрифт (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return arrayBufferToBase64(buf);
}

async function loadFonts(): Promise<LoadedFonts> {
  if (cachedFonts) return cachedFonts;
  const [sansRegular, sansBold, monoRegular, monoBold] = await Promise.all([
    fetchFontBase64(liberationRegularUrl),
    fetchFontBase64(liberationBoldUrl),
    fetchFontBase64(monoRegularUrl),
    fetchFontBase64(monoBoldUrl),
  ]);
  cachedFonts = { sansRegular, sansBold, monoRegular, monoBold };
  return cachedFonts;
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function addCalendarDays(isoDate: string, days: number): string {
  const base = isoDate ? new Date(isoDate) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + Math.max(1, days || 14));
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sanitizeFileSegment(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[/\\]+/g, '-')
    .replace(/[<>:"|?*]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '')
    .trim();
  return cleaned.slice(0, 50) || fallback;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60000);
}

export async function exportProposalPdf({
  proposal,
  packageTitle,
  calc,
}: ExportProposalPdfParams): Promise<string> {
  const fonts = await loadFonts();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // Register embedded local Cyrillic fonts (100% offline, zero external CDN)
  doc.addFileToVFS('ArchSans-Regular.ttf', fonts.sansRegular);
  doc.addFont('ArchSans-Regular.ttf', 'ArchSans', 'normal');
  doc.addFileToVFS('ArchSans-Bold.ttf', fonts.sansBold);
  doc.addFont('ArchSans-Bold.ttf', 'ArchSans', 'bold');
  doc.addFileToVFS('ArchMono-Regular.ttf', fonts.monoRegular);
  doc.addFont('ArchMono-Regular.ttf', 'ArchMono', 'normal');
  doc.addFileToVFS('ArchMono-Bold.ttf', fonts.monoBold);
  doc.addFont('ArchMono-Bold.ttf', 'ArchMono', 'bold');

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  const contentW = pageWidth - marginX * 2; // 180mm
  const bottomLimit = pageHeight - 20;

  const createdFormatted = formatDate(proposal.createdAt);
  const validUntilIso = addCalendarDays(proposal.createdAt, proposal.validDays || 14);
  const validUntilFormatted = formatDate(validUntilIso);
  const albumFormatText = proposal.albumFormat?.trim() || 'PDF + печатный альбом А3';

  let y = 14;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      y = 18;
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.25);
      doc.line(marginX, 12, marginX + contentW, 12);
    }
  };

  // =========================================================================
  // 1. ARCHITECTURAL MASTHEAD (LI.MUR PROJECT RECTANGULAR BRAND MARK)
  // =========================================================================
  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, marginX + contentW, y);
  y += 4;

  // Left: Official full logo LI.MUR PROJECT — «твой интерьер» + subtitle
  const mastheadLogo = await drawLimurLogoPdf(doc, marginX, y, 36);

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(82, 82, 82);
  doc.text(
    'Студия архитектуры и дизайна интерьера  ·  limurproject.ru',
    marginX,
    y + mastheadLogo.heightMm + 3.4
  );

  // Right: Document badge, KP number, date & validity
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 82, 82);
  doc.text('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', marginX + contentW, y + 5.5, { align: 'right' });

  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(10, 10, 10);
  doc.text(proposal.number, marginX + contentW, y + 11.2, { align: 'right' });

  doc.setFont('ArchMono', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 82, 82);
  doc.text(
    `от ${createdFormatted}  ·  действительно до ${validUntilFormatted}`,
    marginX + contentW,
    y + 16,
    { align: 'right' }
  );

  y += mastheadLogo.heightMm + 6.4;
  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, marginX + contentW, y);
  y += 6;

  // =========================================================================
  // 2. OBJECT & CLIENT PASSPORT (2x2 ARCHITECTURAL GRID)
  // =========================================================================
  const halfW = contentW / 2;
  const padX = 3.5;

  const clientNameText = proposal.clientName.trim() || 'Не указан';
  const clientPhoneText = proposal.clientPhone.trim();
  const objectTitleText = proposal.objectTitle.trim() || 'Объект не указан';
  const objectMetaText = [
    proposal.city.trim(),
    proposal.objectType === 'commercial' ? 'Коммерческое помещение' : 'Жилой интерьер',
  ]
    .filter(Boolean)
    .join(' · ');

  const clientNameLines = doc.splitTextToSize(clientNameText, halfW - padX * 2) as string[];
  const objectTitleLines = doc.splitTextToSize(objectTitleText, halfW - padX * 2) as string[];
  const row1H = Math.max(
    18,
    9 + Math.max(clientNameLines.length, objectTitleLines.length) * 4.4 + 4.5
  );

  const pkgTitleLines = doc.splitTextToSize(packageTitle, halfW - padX * 2) as string[];
  const row2H = Math.max(17, 9 + pkgTitleLines.length * 4.4 + 4.5);

  const gridH = row1H + row2H;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.rect(marginX, y, contentW, gridH, 'FD');

  // Inner cross hairlines
  doc.line(marginX + halfW, y, marginX + halfW, y + gridH);
  doc.line(marginX, y + row1H, marginX + contentW, y + row1H);

  // Cell 1,1: Client
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(82, 82, 82);
  doc.text('Заказчик', marginX + padX, y + 4.8);

  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(10, 10, 10);
  doc.text(clientNameLines, marginX + padX, y + 9.8);

  if (clientPhoneText) {
    doc.setFont('ArchMono', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(82, 82, 82);
    doc.text(clientPhoneText, marginX + padX, y + 9.8 + clientNameLines.length * 4.3 + 0.5);
  }

  // Cell 1,2: Object
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(82, 82, 82);
  doc.text('Объект проектирования', marginX + halfW + padX, y + 4.8);

  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(10, 10, 10);
  doc.text(objectTitleLines, marginX + halfW + padX, y + 9.8);

  if (objectMetaText) {
    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(82, 82, 82);
    doc.text(
      objectMetaText,
      marginX + halfW + padX,
      y + 9.8 + objectTitleLines.length * 4.3 + 0.5
    );
  }

  // Cell 2,1: Area & optional measurement plan link
  const row2Y = y + row1H;
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(82, 82, 82);
  doc.text('Площадь по обмерному плану', marginX + padX, row2Y + 4.8);

  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(10, 10, 10);
  doc.text(`${calc.safeArea} м²`, marginX + padX, row2Y + 11.2);

  if (proposal.measurementPlanUrl.trim()) {
    const planHref = normalizeUrl(proposal.measurementPlanUrl.trim());
    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(17, 24, 39);
    doc.textWithLink('Обмерный план ↗', marginX + halfW - padX, row2Y + 11.2, {
      url: planHref,
      align: 'right',
    });
  }

  // Cell 2,2: Package & timeline
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(82, 82, 82);
  doc.text('Выбранный пакет и срок разработки', marginX + halfW + padX, row2Y + 4.8);

  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(10, 10, 10);
  doc.text(pkgTitleLines, marginX + halfW + padX, row2Y + 9.8);

  doc.setFont('ArchMono', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(82, 82, 82);
  doc.text(
    `Ориентировочно ~${calc.totalWorkingDays} рабочих дней`,
    marginX + halfW + padX,
    row2Y + 9.8 + pkgTitleLines.length * 4.3 + 0.5
  );

  y += gridH + 7;

  // =========================================================================
  // 3. SECTION 01: SCOPE OF WORK TABLE
  // =========================================================================
  ensureSpace(22);
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(10, 10, 10);
  doc.text('01. СОСТАВ ПРОЕКТНЫХ РАБОТ', marginX, y);

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(82, 82, 82);
  doc.text(packageTitle, marginX + contentW, y, { align: 'right' });

  y += 2.2;
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + contentW, y);
  y += 1;

  const deliverables = proposal.customDeliverables.length
    ? proposal.customDeliverables
    : ['Состав работ по согласованию с заказчиком'];

  deliverables.forEach((item, idx) => {
    const wrapped = doc.splitTextToSize(item.trim() || '—', contentW - 36) as string[];
    const rowH = Math.max(7.2, wrapped.length * 4 + 3.2);
    ensureSpace(rowH + 2);

    const textY = y + 4.4;

    doc.setFont('ArchMono', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(82, 82, 82);
    doc.text(String(idx + 1).padStart(2, '0'), marginX + 2, textY);

    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(10, 10, 10);
    doc.text(wrapped, marginX + 11, textY);

    doc.setFont('ArchMono', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(21, 128, 61);
    doc.text('Включено', marginX + contentW - 2, textY, { align: 'right' });

    y += rowH;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentW, y);
  });

  const extraOptions: string[] = [];
  if (proposal.options.supervision) {
    extraOptions.push(
      'Авторский надзор (выезды на объект, контроль соответствия проекту, уточнение узлов)'
    );
  }
  if (proposal.options.sourcing) {
    extraOptions.push(
      'Комплектация объекта (подбор поставщиков, сметы, график закупок и поставок)'
    );
  }

  extraOptions.forEach((optText) => {
    const wrapped = doc.splitTextToSize(optText, contentW - 38) as string[];
    const rowH = Math.max(7.4, wrapped.length * 4 + 3.4);
    ensureSpace(rowH + 2);

    doc.setFillColor(248, 249, 250);
    doc.rect(marginX, y, contentW, rowH, 'F');

    const textY = y + 4.5;

    doc.setFont('ArchMono', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(10, 10, 10);
    doc.text('+', marginX + 2.5, textY);

    doc.setFont('ArchSans', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(10, 10, 10);
    doc.text(wrapped, marginX + 11, textY);

    doc.setFont('ArchMono', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(17, 24, 39);
    doc.text('Доп. опция', marginX + contentW - 2, textY, { align: 'right' });

    y += rowH;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentW, y);
  });

  y += 7.5;

  // =========================================================================
  // 4. SECTION 02: COST ESTIMATE & PAYMENT SCHEDULE
  // =========================================================================
  ensureSpace(46);
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(10, 10, 10);
  doc.text('02. РАСЧЁТ СТОИМОСТИ И ГРАФИК ПЛАТЕЖЕЙ', marginX, y);

  doc.setFont('ArchMono', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 82, 82);
  doc.text(
    proposal.paymentTemplate === '30_50_20'
      ? 'RUB (₽)  ·  Схема 30% / 50% / 20%'
      : 'RUB (₽)  ·  Схема 50% / 50%',
    marginX + contentW,
    y,
    { align: 'right' }
  );

  y += 2.2;
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + contentW, y);
  y += 0.5;

  // --- 2A. Cost Estimate Table ---
  const estCols = {
    name: marginX + 2.5,
    areaRight: marginX + 114,
    rateRight: marginX + 145,
    sumRight: marginX + contentW - 2.5,
  };

  doc.setFillColor(248, 249, 250);
  doc.rect(marginX, y, contentW, 6.5, 'F');
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(82, 82, 82);
  doc.text('Наименование', estCols.name, y + 4.3);
  doc.text('Площадь', estCols.areaRight, y + 4.3, { align: 'right' });
  doc.text('Ставка', estCols.rateRight, y + 4.3, { align: 'right' });
  doc.text('Сумма', estCols.sumRight, y + 4.3, { align: 'right' });
  y += 6.5;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, marginX + contentW, y);

  // Base estimate row
  const estTitle = doc.splitTextToSize(`Дизайн-проект — «${packageTitle}»`, 92) as string[];
  const estRowH = Math.max(8, estTitle.length * 4.2 + 3.8);
  const estTextY = y + 5;

  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(8.3);
  doc.setTextColor(10, 10, 10);
  doc.text(estTitle, estCols.name, estTextY);

  doc.setFont('ArchMono', 'normal');
  doc.setFontSize(8.2);
  doc.text(`${calc.safeArea} м²`, estCols.areaRight, estTextY, { align: 'right' });
  doc.text(`${formatCurrency(proposal.ratePerSqm)}/м²`, estCols.rateRight, estTextY, {
    align: 'right',
  });

  doc.setFont('ArchMono', 'bold');
  doc.text(formatCurrency(calc.baseTotal), estCols.sumRight, estTextY, { align: 'right' });

  y += estRowH;
  doc.setDrawColor(229, 231, 235);
  doc.line(marginX, y, marginX + contentW, y);

  // Discount or adjustment row
  if (calc.discountAmount > 0) {
    const discRowH = 7.4;
    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 82);
    doc.text(
      `Персональная скидка / округление по договору (−${calc.discountPercent}%)`,
      estCols.name,
      y + 4.8
    );

    doc.setFont('ArchMono', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(21, 128, 61);
    doc.text(`−${formatCurrency(calc.discountAmount)}`, estCols.sumRight, y + 4.8, {
      align: 'right',
    });

    y += discRowH;
    doc.setDrawColor(229, 231, 235);
    doc.line(marginX, y, marginX + contentW, y);
  } else if (calc.finalTotal > calc.baseTotal) {
    const adjRowH = 7.4;
    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 82);
    doc.text(
      'Корректировка стоимости (дополнительный объём / сложность)',
      estCols.name,
      y + 4.8
    );

    doc.setFont('ArchMono', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(10, 10, 10);
    doc.text(`+${formatCurrency(calc.finalTotal - calc.baseTotal)}`, estCols.sumRight, y + 4.8, {
      align: 'right',
    });

    y += adjRowH;
    doc.setDrawColor(229, 231, 235);
    doc.line(marginX, y, marginX + contentW, y);
  }

  // Inverted charcoal total bar
  const totalBarH = 9.2;
  doc.setFillColor(17, 24, 39);
  doc.rect(marginX, y, contentW, totalBarH, 'F');

  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ИТОГО ПО ДОГОВОРУ', estCols.name, y + 5.9);

  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(10.5);
  doc.text(formatCurrency(calc.finalTotal), estCols.sumRight, y + 6, { align: 'right' });

  y += totalBarH + 5;

  // --- 2B. Payment Schedule Table ---
  ensureSpace(22);
  const payCols = {
    stage: marginX + 2.5,
    daysRight: marginX + 124,
    pctRight: marginX + 144,
    amountRight: marginX + contentW - 2.5,
  };

  doc.setFillColor(248, 249, 250);
  doc.rect(marginX, y, contentW, 6.5, 'F');
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(82, 82, 82);
  doc.text('Этап оплаты', payCols.stage, y + 4.3);
  doc.text('Срок', payCols.daysRight, y + 4.3, { align: 'right' });
  doc.text('Доля', payCols.pctRight, y + 4.3, { align: 'right' });
  doc.text('Сумма', payCols.amountRight, y + 4.3, { align: 'right' });
  y += 6.5;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, marginX + contentW, y);

  calc.rows.forEach((row) => {
    const labelLines = doc.splitTextToSize(row.label, 102) as string[];
    const rowH = Math.max(7.6, labelLines.length * 4 + 3.6);
    ensureSpace(rowH + 2);

    if (row.isAdvance) {
      doc.setFillColor(248, 249, 250);
      doc.rect(marginX, y, contentW, rowH, 'F');
    }

    const textY = y + 4.6;

    doc.setFont('ArchSans', row.isAdvance ? 'bold' : 'normal');
    doc.setFontSize(8.1);
    doc.setTextColor(10, 10, 10);
    doc.text(labelLines, payCols.stage, textY);

    doc.setFont('ArchMono', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(82, 82, 82);
    doc.text(row.workingDays, payCols.daysRight, textY, { align: 'right' });
    doc.text(row.percentLabel, payCols.pctRight, textY, { align: 'right' });

    doc.setFont('ArchMono', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(10, 10, 10);
    doc.text(formatCurrency(row.amount), payCols.amountRight, textY, { align: 'right' });

    y += rowH;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentW, y);
  });

  // Schedule summary row
  ensureSpace(9);
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.35);
  doc.line(marginX, y, marginX + contentW, y);

  doc.setFillColor(248, 249, 250);
  doc.rect(marginX, y + 0.2, contentW, 7.6, 'F');

  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(10, 10, 10);
  doc.text('Всего к оплате по договору', payCols.stage, y + 5.1);

  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(8.8);
  doc.text(formatCurrency(calc.finalTotal), payCols.amountRight, y + 5.1, { align: 'right' });

  y += 14.5;

  // =========================================================================
  // 5. SECTION 03: WORK CONDITIONS & FORMAT
  // =========================================================================
  ensureSpace(24);
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(10, 10, 10);
  doc.text('03. УСЛОВИЯ РАБОТЫ И ФОРМАТ ПЕРЕДАЧИ', marginX, y);
  y += 2.2;
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + contentW, y);
  y += 3;

  const thirdW = contentW / 3;
  const formatLines = doc.splitTextToSize(albumFormatText, thirdW - 6) as string[];
  const condH = Math.max(15.5, 9 + formatLines.length * 4.1 + 2.5);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.rect(marginX, y, contentW, condH, 'FD');
  doc.line(marginX + thirdW, y, marginX + thirdW, y + condH);
  doc.line(marginX + thirdW * 2, y, marginX + thirdW * 2, y + condH);

  // Col 1: Revisions
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(82, 82, 82);
  doc.text('Круги правок', marginX + 3, y + 4.8);
  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(8.3);
  doc.setTextColor(10, 10, 10);
  doc.text(`${proposal.revisionRounds} круга на каждом этапе`, marginX + 3, y + 10.2);

  // Col 2: Album Format
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(82, 82, 82);
  doc.text('Формат выдачи проекта', marginX + thirdW + 3, y + 4.8);
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(8.3);
  doc.setTextColor(10, 10, 10);
  doc.text(formatLines, marginX + thirdW + 3, y + 10.2);

  // Col 3: Validity
  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(82, 82, 82);
  doc.text('Срок действия КП', marginX + thirdW * 2 + 3, y + 4.8);
  doc.setFont('ArchMono', 'bold');
  doc.setFontSize(8.3);
  doc.setTextColor(10, 10, 10);
  doc.text(`${proposal.validDays} дн. (до ${validUntilFormatted})`, marginX + thirdW * 2 + 3, y + 10.2);

  y += condH + 9;

  // =========================================================================
  // 6. SIGNATURE & CONTACTS BLOCK
  // =========================================================================
  ensureSpace(48);
  doc.setDrawColor(10, 10, 10);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, marginX + contentW, y);
  y += 5;

  const sigColW = (contentW - 14) / 2;
  const rightColX = marginX + sigColW + 14;

  // Left: Studio block with compact full LI.MUR PROJECT logo
  const footerLogo = await drawLimurLogoPdf(doc, marginX, y, 24);

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(82, 82, 82);
  doc.text(
    'Архитектурное проектирование и дизайн интерьеров',
    marginX,
    y + footerLogo.heightMm + 3.2
  );

  doc.setFont('ArchMono', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(10, 10, 10);
  doc.textWithLink('https://limurproject.ru', marginX, y + footerLogo.heightMm + 7.4, {
    url: 'https://limurproject.ru',
  });

  // Right: Client approval block
  doc.setFont('ArchSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(10, 10, 10);
  doc.text('Согласование заказчика', rightColX, y + 3.2);

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 82);
  doc.text(proposal.clientName.trim() || 'Заказчик', rightColX, y + 7.8);

  if (proposal.status === 'approved') {
    doc.setFont('ArchSans', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(21, 128, 61);
    doc.text('Статус: Согласовано', rightColX, y + 12.2);
  }

  // Signature hairlines
  const sigLineY = y + footerLogo.heightMm + 16;
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.3);
  doc.line(marginX, sigLineY, marginX + sigColW, sigLineY);
  doc.line(rightColX, sigLineY, rightColX + sigColW, sigLineY);

  doc.setFont('ArchSans', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(115, 115, 115);
  doc.text('Руководитель студии', marginX, sigLineY + 3.8);
  doc.text('Подпись / дата', marginX + sigColW, sigLineY + 3.8, { align: 'right' });

  doc.text('Заказчик', rightColX, sigLineY + 3.8);
  doc.text('Подпись / дата', rightColX + sigColW, sigLineY + 3.8, { align: 'right' });

  // =========================================================================
  // 7. EDITORIAL FOOTER ON EVERY PAGE
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 10;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.25);
    doc.line(marginX, footerY - 4, marginX + contentW, footerY - 4);

    doc.setFont('ArchSans', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(115, 115, 115);
    doc.text(
      `LI.MUR PROJECT  ·  limurproject.ru  ·  Коммерческое предложение ${proposal.number}`,
      marginX,
      footerY
    );

    doc.setFont('ArchMono', 'normal');
    doc.setFontSize(7.4);
    doc.text(`Стр. ${p} / ${totalPages}`, marginX + contentW, footerY, { align: 'right' });
  }

  // Build safe filename & trigger guaranteed Blob download (works in iframe, GitHub Pages, iOS/Android)
  const safeNum = sanitizeFileSegment(proposal.number, 'КП');
  const safeObj = sanitizeFileSegment(proposal.objectTitle.trim(), 'Объект');
  const fileName = `${safeNum}_${safeObj}_LIMUR_PROJECT.pdf`;

  const pdfBlob = doc.output('blob');
  triggerBlobDownload(pdfBlob, fileName);

  return fileName;
}
