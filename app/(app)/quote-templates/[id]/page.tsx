import { requirePageUser } from "@/lib/core/pageAuth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import QuoteTemplateBuilder from "@/components/sales/QuoteTemplateBuilder";

export default async function QuoteTemplateDetailPage({ params }: { params: { id: string } }) {
  await requirePageUser();

  const template = await db.quoteTemplate.findUnique({
    where: { id: params.id },
    include: {
      lineItems: {
        orderBy: { displayOrder: "asc" }
      },
    },
  });

  if (!template || template.deletedAt !== null) {
    notFound();
  }

  return <QuoteTemplateBuilder initialTemplate={template} />;
}
