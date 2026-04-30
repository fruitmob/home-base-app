import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { CsvReportSection } from "./export";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const FOOTER_HEIGHT = 18;

const FONT_SIZE_TITLE = 18;
const FONT_SIZE_META = 10;
const FONT_SIZE_SECTION = 13;
const FONT_SIZE_DESCRIPTION = 9.5;
const FONT_SIZE_BODY = 9.5;

const COLOR_BODY = rgb(0.06, 0.09, 0.16);
const COLOR_MUTED = rgb(0.42, 0.48, 0.55);
const COLOR_ACCENT = rgb(0.12, 0.25, 0.45);
const COLOR_RULE = rgb(0.85, 0.88, 0.92);
const COLOR_BAND = rgb(0.95, 0.96, 0.98);

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type PageContext = {
  doc: PDFDocument;
  page: PDFPage;
  fonts: Fonts;
  cursorY: number;
  pageNumber: number;
  title: string;
  meta: string;
};

export async function renderReportPdf(
  reportTitle: string,
  generatedAt: Date,
  sections: readonly CsvReportSection[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(reportTitle);
  doc.setCreator("Home Base");
  doc.setProducer("Home Base");
  doc.setCreationDate(generatedAt);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { regular, bold };

  const metaLine = `Generated ${formatGeneratedAt(generatedAt)}`;
  const ctx: PageContext = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    fonts,
    cursorY: PAGE_HEIGHT - MARGIN_TOP,
    pageNumber: 1,
    title: reportTitle,
    meta: metaLine,
  };

  drawHeader(ctx);

  for (const section of sections) {
    drawSection(ctx, section);
  }

  stampPageFooters(ctx);

  return doc.save();
}

function drawHeader(ctx: PageContext) {
  ctx.page.drawText("Home Base", {
    x: MARGIN_X,
    y: ctx.cursorY,
    size: FONT_SIZE_META,
    font: ctx.fonts.bold,
    color: COLOR_ACCENT,
  });
  ctx.cursorY -= 18;

  ctx.page.drawText(ctx.title, {
    x: MARGIN_X,
    y: ctx.cursorY,
    size: FONT_SIZE_TITLE,
    font: ctx.fonts.bold,
    color: COLOR_BODY,
  });
  ctx.cursorY -= 18;

  ctx.page.drawText(ctx.meta, {
    x: MARGIN_X,
    y: ctx.cursorY,
    size: FONT_SIZE_META,
    font: ctx.fonts.regular,
    color: COLOR_MUTED,
  });
  ctx.cursorY -= 12;

  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.cursorY },
    end: { x: PAGE_WIDTH - MARGIN_X, y: ctx.cursorY },
    thickness: 0.6,
    color: COLOR_RULE,
  });
  ctx.cursorY -= 16;
}

function drawSection(ctx: PageContext, section: CsvReportSection) {
  ensureSpace(ctx, 48);

  ctx.page.drawText(section.title, {
    x: MARGIN_X,
    y: ctx.cursorY,
    size: FONT_SIZE_SECTION,
    font: ctx.fonts.bold,
    color: COLOR_BODY,
  });
  ctx.cursorY -= 14;

  if (section.description) {
    const lines = wrapText(section.description, ctx.fonts.regular, FONT_SIZE_DESCRIPTION, contentWidth());
    for (const line of lines) {
      ensureSpace(ctx, FONT_SIZE_DESCRIPTION + 4);
      ctx.page.drawText(line, {
        x: MARGIN_X,
        y: ctx.cursorY,
        size: FONT_SIZE_DESCRIPTION,
        font: ctx.fonts.regular,
        color: COLOR_MUTED,
      });
      ctx.cursorY -= FONT_SIZE_DESCRIPTION + 3;
    }
    ctx.cursorY -= 4;
  }

  if (section.rows.length === 0) {
    ensureSpace(ctx, 16);
    ctx.page.drawText("No rows in this window.", {
      x: MARGIN_X,
      y: ctx.cursorY,
      size: FONT_SIZE_BODY,
      font: ctx.fonts.regular,
      color: COLOR_MUTED,
    });
    ctx.cursorY -= 20;
    return;
  }

  const valueColumnWidth = 96;
  const valueColumnX = PAGE_WIDTH - MARGIN_X - valueColumnWidth;
  const labelColumnX = MARGIN_X;
  const labelColumnWidth = valueColumnX - labelColumnX - 12;

  let rowIndex = 0;
  for (const row of section.rows) {
    const detailLines = row.detail
      ? wrapText(row.detail, ctx.fonts.regular, FONT_SIZE_DESCRIPTION, labelColumnWidth)
      : [];
    const labelLines = wrapText(row.label, ctx.fonts.bold, FONT_SIZE_BODY, labelColumnWidth);
    const valueLines = wrapText(row.value, ctx.fonts.bold, FONT_SIZE_BODY, valueColumnWidth);
    const bodyHeight =
      Math.max(labelLines.length, valueLines.length) * (FONT_SIZE_BODY + 3) +
      detailLines.length * (FONT_SIZE_DESCRIPTION + 3);
    const rowHeight = bodyHeight + 8;
    ensureSpace(ctx, rowHeight);

    if (rowIndex % 2 === 0) {
      ctx.page.drawRectangle({
        x: MARGIN_X - 4,
        y: ctx.cursorY - rowHeight + 4,
        width: contentWidth() + 8,
        height: rowHeight,
        color: COLOR_BAND,
      });
    }

    let labelCursor = ctx.cursorY - 2;
    for (const line of labelLines) {
      ctx.page.drawText(line, {
        x: labelColumnX,
        y: labelCursor,
        size: FONT_SIZE_BODY,
        font: ctx.fonts.bold,
        color: COLOR_BODY,
      });
      labelCursor -= FONT_SIZE_BODY + 3;
    }

    for (const line of detailLines) {
      ctx.page.drawText(line, {
        x: labelColumnX,
        y: labelCursor,
        size: FONT_SIZE_DESCRIPTION,
        font: ctx.fonts.regular,
        color: COLOR_MUTED,
      });
      labelCursor -= FONT_SIZE_DESCRIPTION + 3;
    }

    let valueCursor = ctx.cursorY - 2;
    for (const line of valueLines) {
      const width = ctx.fonts.bold.widthOfTextAtSize(line, FONT_SIZE_BODY);
      ctx.page.drawText(line, {
        x: PAGE_WIDTH - MARGIN_X - width,
        y: valueCursor,
        size: FONT_SIZE_BODY,
        font: ctx.fonts.bold,
        color: COLOR_BODY,
      });
      valueCursor -= FONT_SIZE_BODY + 3;
    }

    ctx.cursorY -= rowHeight;
    rowIndex += 1;
  }

  ctx.cursorY -= 6;
}

function ensureSpace(ctx: PageContext, required: number) {
  if (ctx.cursorY - required >= MARGIN_BOTTOM + FOOTER_HEIGHT) {
    return;
  }
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.cursorY = PAGE_HEIGHT - MARGIN_TOP;
  ctx.pageNumber += 1;
  drawHeader(ctx);
}

function stampPageFooters(ctx: PageContext) {
  const pages = ctx.doc.getPages();
  const total = pages.length;
  for (let i = 0; i < total; i += 1) {
    const page = pages[i];
    const footerText = `Home Base  |  ${ctx.meta}  |  Page ${i + 1} of ${total}`;
    page.drawText(footerText, {
      x: MARGIN_X,
      y: MARGIN_BOTTOM - 8,
      size: 8,
      font: ctx.fonts.regular,
      color: COLOR_MUTED,
    });
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const normalized = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      current = truncateToWidth(word, font, size, maxWidth);
    } else {
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  let best = "";
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ellipsis;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best || ellipsis;
}

function contentWidth() {
  return PAGE_WIDTH - MARGIN_X * 2;
}

function formatGeneratedAt(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
