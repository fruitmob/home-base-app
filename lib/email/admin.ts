import { db } from "@/lib/db";

export type EmailTemplateSummary = {
  key: string;
  label: string;
  description: string | null;
  subject: string;
  version: number;
  variables: string[];
  updatedAt: Date;
};

export type EmailSendSummary = {
  id: string;
  templateKey: string;
  templateVersion: number;
  recipientEmail: string;
  subject: string;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

export async function listEmailTemplatesForAdmin(): Promise<EmailTemplateSummary[]> {
  const templates = await db.emailTemplate.findMany({
    where: { deletedAt: null },
    orderBy: [{ label: "asc" }],
  });

  return templates.map((template) => ({
    key: template.key,
    label: template.label,
    description: template.description,
    subject: template.subject,
    version: template.version,
    variables: Array.isArray(template.variablesJson)
      ? template.variablesJson.filter((entry): entry is string => typeof entry === "string")
      : [],
    updatedAt: template.updatedAt,
  }));
}

export async function listRecentEmailSends(take = 50): Promise<EmailSendSummary[]> {
  const rows = await db.emailSend.findMany({
    orderBy: [{ createdAt: "desc" }],
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    templateKey: row.templateKey,
    templateVersion: row.templateVersion,
    recipientEmail: row.recipientEmail,
    subject: row.subject,
    status: row.status,
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  }));
}

export async function getEmailSendCounts() {
  const groups = await db.emailSend.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts = { total: 0, sent: 0, simulated: 0, failed: 0, queued: 0 };
  for (const group of groups) {
    const count = group._count._all;
    counts.total += count;
    switch (group.status) {
      case "SENT":
        counts.sent = count;
        break;
      case "SIMULATED":
        counts.simulated = count;
        break;
      case "FAILED":
        counts.failed = count;
        break;
      case "QUEUED":
        counts.queued = count;
        break;
    }
  }
  return counts;
}
