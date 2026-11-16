import { jsPDF } from 'jspdf';
import { encodeCode128B } from './barcode';

const DENSITY_MODULE_MM = {
  compact: 0.24,
  standard: 0.32,
  wide: 0.42
};

function hasExtendedGlyphs(str) {
  return /[^\u0000-\u024F]/.test(String(str || ''));
}

function drawCanvasText(doc, text, xMm, yMm, maxWidthMm, fontSizePt, { bold = false, align = 'center', color = '#0f172a' } = {}) {
  const scale = 6; // high-DPI rasterization for non-Latin scripts (e.g. Arabic)
  const mmToPx = (96 / 25.4) * scale;
  const pxWidth = Math.max(20, Math.round(maxWidthMm * mmToPx));
  const pxFont = Math.max(12, Math.round((fontSizePt * 25.4 / 72) * mmToPx));
  const pxHeight = Math.round(pxFont * 1.45);

  const canvas = document.createElement('canvas');
  canvas.width = pxWidth;
  canvas.height = pxHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, pxWidth, pxHeight);
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${pxFont}px "Segoe UI", Tahoma, Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  let drawText = String(text || '');
  while (drawText.length > 1 && ctx.measureText(drawText).width > pxWidth - 4) {
    drawText = `${drawText.slice(0, -2)}…`;
  }

  let drawX = pxWidth / 2;
  ctx.textAlign = 'center';
  if (align === 'left') {
    ctx.textAlign = 'left';
    drawX = 0;
  } else if (align === 'right') {
    ctx.textAlign = 'right';
    drawX = pxWidth;
  }
  ctx.fillText(drawText, drawX, pxHeight / 2);

  const imgHeightMm = (pxHeight / mmToPx);
  const leftMm = align === 'center' ? xMm - maxWidthMm / 2 : align === 'right' ? xMm - maxWidthMm : xMm;
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', leftMm, yMm - imgHeightMm * 0.65, maxWidthMm, imgHeightMm);
}

function truncateLatinToWidth(doc, text, maxWidthMm) {
  let s = String(text || '');
  if (doc.getTextWidth(s) <= maxWidthMm) return s;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxWidthMm) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function drawLabelCard(doc, label, originX, originY, template, storeName, lang, formatPrice) {
  const w = Number(template.labelWidthMm) || 63;
  const h = Number(template.labelHeightMm) || 38;
  const fontSize = Math.max(6, Math.min(18, Number(template.fontSize) || 10));
  const padX = Math.max(2, Math.min(4, w * 0.06));
  const padY = Math.max(1.8, Math.min(3.5, h * 0.07));
  const innerW = Math.max(10, w - padX * 2);

  // White card background + subtle cut border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(originX, originY, w, h, 'FD');

  let cursorY = originY + padY;

  // 1. Store header
  if (template.showStore) {
    const storePt = Math.max(5.5, fontSize * 0.72);
    const storeText = String(storeName || '').toUpperCase();
    if (hasExtendedGlyphs(storeText)) {
      drawCanvasText(doc, storeText, originX + w / 2, cursorY + storePt * 0.28, innerW, storePt, {
        bold: true,
        color: '#475569'
      });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(storePt);
      doc.setTextColor(71, 85, 105);
      doc.text(truncateLatinToWidth(doc, storeText, innerW), originX + w / 2, cursorY + storePt * 0.3, {
        align: 'center'
      });
    }
    cursorY += storePt * 0.42 + 0.8;
  }

  // 2. Product name
  if (template.showName) {
    const prodName = lang === 'ar' && label.product.name_ar ? label.product.name_ar : label.product.name;
    if (hasExtendedGlyphs(prodName)) {
      drawCanvasText(doc, prodName, originX + w / 2, cursorY + fontSize * 0.3, innerW, fontSize, {
        bold: true,
        color: '#0f172a'
      });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(15, 23, 42);
      doc.text(truncateLatinToWidth(doc, prodName, innerW), originX + w / 2, cursorY + fontSize * 0.33, {
        align: 'center'
      });
    }
    cursorY += fontSize * 0.44 + 1.0;
  }

  // Footer reservation
  const footerPt = Math.max(6, fontSize * 0.85);
  const pricePt = Math.max(7, fontSize * 1.05);
  const footerHeight = Math.max(footerPt, pricePt) * 0.42 + padY;
  const availableBarH = Math.max(5, originY + h - footerHeight - cursorY - 1.2);
  const desiredBarH = Math.min(availableBarH, Math.max(6, Number(template.barcodeHeightMm) || 12));

  // 3. Vector Code 128B Barcode
  const encoded = encodeCode128B(label.code);
  if (encoded.bars.length > 0 && encoded.totalWidth > 0) {
    const targetMod = DENSITY_MODULE_MM[template.barcodeDensity] || DENSITY_MODULE_MM.standard;
    const maxMod = innerW / encoded.totalWidth;
    const modWidth = Math.min(targetMod, maxMod);
    const totalDrawW = encoded.totalWidth * modWidth;
    const barStartX = originX + (w - totalDrawW) / 2;
    const barStartY = cursorY + Math.max(0, (availableBarH - desiredBarH) / 2);

    doc.setFillColor(0, 0, 0);
    for (const bar of encoded.bars) {
      doc.rect(barStartX + bar.x * modWidth, barStartY, bar.width * modWidth, desiredBarH, 'F');
    }
  }

  // 4. Footer: Human-readable code & price
  const footerBaselineY = originY + h - padY - 0.5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(footerPt);
  doc.setTextColor(15, 23, 42);

  if (template.showPrice) {
    const priceStr = formatPrice(label.product.sell_price, lang);
    const codeMaxW = innerW * 0.54;
    doc.text(truncateLatinToWidth(doc, label.code, codeMaxW), originX + padX, footerBaselineY, {
      align: 'left'
    });

    if (hasExtendedGlyphs(priceStr)) {
      drawCanvasText(doc, priceStr, originX + w - padX, footerBaselineY - 0.6, innerW * 0.44, pricePt, {
        bold: true,
        align: 'right',
        color: '#0f172a'
      });
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(pricePt);
      doc.text(priceStr, originX + w - padX, footerBaselineY, { align: 'right' });
    }
  } else {
    doc.text(truncateLatinToWidth(doc, label.code, innerW), originX + w / 2, footerBaselineY, {
      align: 'center'
    });
  }
}

export function exportBarcodeLabelsToPdf({ labels, template, storeName, lang, formatPrice }) {
  if (!labels || labels.length === 0) return;

  const labelW = Math.max(25, Math.min(180, Number(template.labelWidthMm) || 63));
  const labelH = Math.max(18, Math.min(150, Number(template.labelHeightMm) || 38));

  if (template.layout === 'thermal') {
    const doc = new jsPDF({
      orientation: labelW >= labelH ? 'l' : 'p',
      unit: 'mm',
      format: [labelW, labelH]
    });

    labels.forEach((lbl, idx) => {
      if (idx > 0) {
        doc.addPage([labelW, labelH], labelW >= labelH ? 'l' : 'p');
      }
      drawLabelCard(doc, lbl, 0, 0, template, storeName, lang, formatPrice);
    });

    doc.save(`etiquettes-thermique-${labelW}x${labelH}mm.pdf`);
    return;
  }

  // A4 Sheet mode (210 x 297 mm)
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const marginX = 8;
  const marginY = 10;
  const gapX = 4;
  const gapY = 4;

  const requestedCols = Math.max(1, Math.min(5, Math.round(Number(template.columns) || 3)));
  const maxFitCols = Math.max(1, Math.floor((pageW - marginX * 2 + gapX) / (labelW + gapX)));
  const cols = Math.min(requestedCols, maxFitCols);

  const totalGridW = cols * labelW + (cols - 1) * gapX;
  const startX = Math.max(marginX, (pageW - totalGridW) / 2);
  const rowsPerPage = Math.max(1, Math.floor((pageH - marginY * 2 + gapY) / (labelH + gapY)));
  const perPage = cols * rowsPerPage;

  labels.forEach((lbl, idx) => {
    const pageIdx = idx % perPage;
    if (idx > 0 && pageIdx === 0) {
      doc.addPage('a4', 'p');
    }
    const col = pageIdx % cols;
    const row = Math.floor(pageIdx / cols);
    const x = startX + col * (labelW + gapX);
    const y = marginY + row * (labelH + gapY);
    drawLabelCard(doc, lbl, x, y, template, storeName, lang, formatPrice);
  });

  doc.save(`etiquettes-codes-barres-a4.pdf`);
}
