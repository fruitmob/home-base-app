import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import QuoteBuilder from "@/components/sales/QuoteBuilder";

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  await requirePageUser();

  const quote = await db.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      opportunity: true,
      vehicle: true,
      createdByUser: true,
      lineItems: {
        orderBy: { displayOrder: "asc" }
      },
      revisions: {
        where: { deletedAt: null },
        orderBy: { version: "desc" }
      },
      parentQuote: {
        include: {
           revisions: {
              where: { deletedAt: null },
              orderBy: { version: "desc" }
           }
        }
      }
    },
  });

  if (!quote || quote.deletedAt !== null) {
    notFound();
  }

  return <QuoteBuilder initialQuote={quote} />;
}
