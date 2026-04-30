import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "@/lib/db";
import { format } from "date-fns";

/**
 * Generates a non-interactive PDF Buffer for a given Quote.
 */
export async function generateQuotePdf(quoteId: string): Promise<Uint8Array> {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      customer: true,
      vehicle: true,
      lineItems: {
        orderBy: { displayOrder: "asc" },
      },
      createdByUser: true,
      opportunity: true,
    },
  });

  if (!quote) {
    throw new Error("Quote not found for PDF generation.");
  }

  // Create a new PDFDocument
  const pdfDoc = await PDFDocument.create();
  
  // Embed standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add a blank page
  let page = pdfDoc.addPage([612, 792]); // Standard US Letter
  const { width, height } = page.getSize();
  let cursorY = height - 50;
  
  const marginX = 50;

  const drawText = (text: string, x: number, y: number, f = font, size = 12, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x, y, size, font: f, color });
  };

  // Header
  // TODO: Insert Company Logo here when available
  drawText("HOME BASE", marginX, cursorY, boldFont, 24);
  
  drawText("QUOTE", width - marginX - 80, cursorY, boldFont, 24, rgb(0.3, 0.3, 0.3));
  cursorY -= 20;

  // Shop Info
  drawText("123 Main Street", marginX, cursorY, font, 10, rgb(0.4, 0.4, 0.4));
  cursorY -= 15;
  drawText("Anytown, ST 12345", marginX, cursorY, font, 10, rgb(0.4, 0.4, 0.4));
  cursorY -= 30;

  // Quote Details Panel
  const rightAlign = width - marginX - 150;
  drawText(`Quote #:`, rightAlign, cursorY + 45, boldFont, 10);
  drawText(quote.quoteNumber, rightAlign + 60, cursorY + 45, font, 10);

  drawText(`Date:`, rightAlign, cursorY + 30, boldFont, 10);
  drawText(quote.issuedAt ? format(quote.issuedAt, "MMM dd, yyyy") : format(new Date(), "MMM dd, yyyy"), rightAlign + 60, cursorY + 30, font, 10);

  if (quote.validUntil) {
    drawText(`Valid Until:`, rightAlign, cursorY + 15, boldFont, 10);
    drawText(format(quote.validUntil, "MMM dd, yyyy"), rightAlign + 60, cursorY + 15, font, 10);
  }

  // Customer Details
  drawText("PREPARED FOR:", marginX, cursorY, boldFont, 10, rgb(0.5, 0.5, 0.5));
  cursorY -= 15;
  drawText(quote.customer.displayName || "Valued Customer", marginX, cursorY, boldFont, 12);
  cursorY -= 15;
  if (quote.customer.email) drawText(quote.customer.email, marginX, cursorY, font, 10);
  cursorY -= 15;
  if (quote.customer.phone) drawText(quote.customer.phone, marginX, cursorY, font, 10);
  cursorY -= 30;

  // Line Items Table Header
  const colDescrX = marginX;
  const colQtyX = width - 200;
  const colPriceX = width - 140;
  const colTotalX = width - marginX - 40;

  // Draw header background
  page.drawRectangle({
    x: marginX,
    y: cursorY - 5,
    width: width - marginX * 2,
    height: 20,
    color: rgb(0.95, 0.95, 0.95),
  });

  drawText("DESCRIPTION", colDescrX + 5, cursorY, boldFont, 10);
  drawText("QTY", colQtyX, cursorY, boldFont, 10);
  drawText("PRICE", colPriceX, cursorY, boldFont, 10);
  drawText("TOTAL", colTotalX, cursorY, boldFont, 10);
  
  cursorY -= 25;

  // Line Items
  for (const item of quote.lineItems) {
    if (cursorY < 100) {
      // Create new page
      page = pdfDoc.addPage([612, 792]);
      cursorY = height - 50;
    }

    const qty = Number(item.quantity).toString();
    const up = `$${Number(item.unitPrice).toFixed(2)}`;
    const lt = `$${Number(item.lineTotal).toFixed(2)}`;

    drawText(item.description.substring(0, 50) + (item.description.length > 50 ? "..." : ""), colDescrX + 5, cursorY, font, 10);
    drawText(qty, colQtyX, cursorY, font, 10);
    drawText(up, colPriceX, cursorY, font, 10);
    drawText(lt, colTotalX, cursorY, font, 10);
    
    cursorY -= 15;
    page.drawLine({
      start: { x: marginX, y: cursorY + 10 },
      end: { x: width - marginX, y: cursorY + 10 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
    cursorY -= 5;
  }

  cursorY -= 20;

  // Totals Area
  const totalsX = width - marginX - 150;
  const totalsValsX = width - marginX - 50;

  drawText("Subtotal:", totalsX, cursorY, font, 10);
  drawText(`$${Number(quote.subtotal).toFixed(2)}`, totalsValsX, cursorY, font, 10);
  cursorY -= 15;

  drawText("Tax:", totalsX, cursorY, font, 10);
  drawText(`$${Number(quote.taxTotal).toFixed(2)}`, totalsValsX, cursorY, font, 10);
  cursorY -= 15;

  drawText("Total:", totalsX, cursorY, boldFont, 12);
  drawText(`$${Number(quote.total).toFixed(2)}`, totalsValsX, cursorY, boldFont, 12);

  cursorY -= 50;

  // Notes
  if (quote.notes) {
    drawText("NOTES / TERMS", marginX, cursorY, boldFont, 10, rgb(0.5, 0.5, 0.5));
    cursorY -= 15;
    
    // Simple text wrapping hack
    const words = quote.notes.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line + word + ' ';
      const textWidth = font.widthOfTextAtSize(testLine, 10);
      if (textWidth > width - marginX * 2) {
        drawText(line, marginX, cursorY, font, 10);
        cursorY -= 15;
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    drawText(line, marginX, cursorY, font, 10);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
