import { db } from "@/lib/db";
import { QuoteStatus } from "@/generated/prisma/client";
import { notFound } from "@/lib/core/api";
import { HttpError } from "@/lib/auth";
import { lineTotal } from "@/lib/core/money";
import { withQuoteNumberRetry } from "./quoteNumber";

export async function findActiveQuote(id: string) {
  const quote = await db.quote.findUnique({
    where: { id },
  });

  if (!quote || quote.deletedAt !== null) {
    notFound("Quote not found.");
  }
  return quote;
}

export async function findActiveQuoteTemplate(id: string) {
  const template = await db.quoteTemplate.findUnique({
    where: { id },
  });

  if (!template || template.deletedAt !== null) {
    notFound("QuoteTemplate not found.");
  }
  return template;
}

/**
 * Recomputes and updates the quote totals (subtotal, taxTotal, total)
 * based on all non-deleted line items currently attached.
 */
export async function recomputeQuoteTotals(quoteId: string) {
  const lines = await db.quoteLineItem.findMany({
    where: { quoteId },
    select: {
      lineTotal: true,
      taxable: true,
    },
  });

  let subtotal = 0;
  const taxTotal = 0;

  for (const line of lines) {
    const amt = Number(line.lineTotal);
    subtotal += amt;
    // Assuming simple tax calculation for MVP if taxable = true
    // (In reality this would use a proper tax rate lookup, but for now we'll do a placeholder or assume 0% if no global setting exists. Let's assume 0% tax for the template and allow it to be augmented later).
    if (line.taxable) {
      // e.g. taxTotal += amt * 0.08
    }
  }

  const total = subtotal + taxTotal;

  await db.quote.update({
    where: { id: quoteId },
    data: {
      subtotal,
      taxTotal,
      total,
      updatedAt: new Date(),
    },
  });
}

export function requireDraftQuote(quote: { status: QuoteStatus }) {
  if (quote.status !== QuoteStatus.DRAFT) {
    throw new HttpError(400, "Only draft quotes can be edited. Revise this quote to make changes.");
  }
}

export function requireRevisableQuote(quote: { status: QuoteStatus }) {
  if (quote.status === QuoteStatus.DRAFT) {
    throw new HttpError(400, "Draft quotes can be edited in place and do not need a revision.");
  }
}

/**
 * Creates a new Version + 1 quote as a child of the original quote.
 * Clones all line items exactly, but gets a fresh quoteNumber.
 * The new quote is returned in DRAFT status.
 */
export async function reviseQuote(originalQuoteId: string, authorUserId: string | null) {
  const original = await findActiveQuote(originalQuoteId);
  requireRevisableQuote(original);
  
  const originalLines = await db.quoteLineItem.findMany({
    where: { quoteId: originalQuoteId },
  });

  return withQuoteNumberRetry(async (nextQuoteNumber) => {
    // Generate new quote inside a transaction if desired, or sequentially.
    return db.quote.create({
      data: {
        quoteNumber: nextQuoteNumber,
        version: original.version + 1,
        parentQuoteId: original.id,
        customerId: original.customerId,
        vehicleId: original.vehicleId,
        opportunityId: original.opportunityId,
        pricebookId: original.pricebookId,
        status: QuoteStatus.DRAFT,
        issuedAt: null, // Reset status timing
        validUntil: original.validUntil,
        notes: original.notes,
        subtotal: original.subtotal,
        taxTotal: original.taxTotal,
        total: original.total,
        createdByUserId: authorUserId,
        lineItems: {
          create: originalLines.map(line => ({
            productId: line.productId,
            sku: line.sku,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            taxable: line.taxable,
            displayOrder: line.displayOrder,
          }))
        }
      }
    });
  });
}

/**
 * Applies a template to a quote by inserting its line items.
 * If the template line has no unitPrice, it resolves the unitPrice from the Quote's pricebook
 * (which comes from the customer's override or the global default).
 */
export async function applyTemplateToQuote(quoteId: string, templateId: string) {
  const quote = await findActiveQuote(quoteId);
  await findActiveQuoteTemplate(templateId);

  const templateLines = await db.quoteTemplateLineItem.findMany({
    where: { templateId },
    orderBy: { displayOrder: "asc" },
  });

  if (templateLines.length === 0) return quote; // Nothing to apply

  // Find effective pricebook
  let pricebookId = quote.pricebookId;
  if (!pricebookId) {
    const customer = await db.customer.findUnique({ where: { id: quote.customerId } });
    pricebookId = customer?.defaultPricebookId || null;
  }
  if (!pricebookId) {
    const defaultPb = await db.pricebook.findFirst({ where: { isDefault: true, active: true, deletedAt: null } });
    pricebookId = defaultPb?.id || null;
  }

  // Gather prices for template lines that have no unitPrice
  const unresolvedProductIds = templateLines
    .filter(l => l.unitPrice === null && l.productId)
    .map(l => l.productId as string);

  const defaultPrices: Record<string, number> = {};
  
  if (unresolvedProductIds.length > 0) {
    if (pricebookId) {
      // Find prices from pricebook
      const entries = await db.pricebookEntry.findMany({
        where: {
          pricebookId,
          productId: { in: unresolvedProductIds },
          deletedAt: null,
        }
      });
      for (const e of entries) {
        defaultPrices[e.productId] = Number(e.unitPrice);
      }
    }
    // Fallback to Product.defaultUnitPrice for any still unresolved
    const stillUnresolved = unresolvedProductIds.filter(id => defaultPrices[id] === undefined);
    if (stillUnresolved.length > 0) {
      const products = await db.product.findMany({
        where: { id: { in: stillUnresolved } },
        select: { id: true, defaultUnitPrice: true }
      });
      for (const p of products) {
        defaultPrices[p.id] = Number(p.defaultUnitPrice);
      }
    }
  }

  // Figure out the max current display order so we can append
  const lastLine = await db.quoteLineItem.findFirst({
    where: { quoteId },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true }
  });
  let nextDisplayOrder = lastLine ? lastLine.displayOrder + 1 : 0;

  const newLines = templateLines.map(tLine => {
    let price = Number(tLine.unitPrice || 0);
    if (tLine.unitPrice === null && tLine.productId) {
      price = defaultPrices[tLine.productId] ?? 0;
    }
    const qty = Number(tLine.quantity);

    const line = {
      quoteId,
      productId: tLine.productId,
      sku: tLine.sku,
      description: tLine.description,
      quantity: qty,
      unitPrice: price,
      lineTotal: lineTotal(qty, price),
      taxable: tLine.taxable,
      displayOrder: nextDisplayOrder++,
    };
    return line;
  });

  await db.quoteLineItem.createMany({
    data: newLines,
  });

  // Finally recompute totals
  await recomputeQuoteTotals(quoteId);
}
