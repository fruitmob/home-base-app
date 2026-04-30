import { db } from "@/lib/db";

export type EmailTemplateSeed = {
  key: string;
  label: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
};

export const EMAIL_TEMPLATE_SEEDS: readonly EmailTemplateSeed[] = [
  {
    key: "portal.magic-link",
    label: "Customer portal magic link",
    description: "Sends the customer a tokenized link to their portal.",
    subject: "Your Home Base portal link",
    html: `<p>Hi {{customerName}},</p>
<p>Here is your secure link to review work orders, estimates, and messages for your account.</p>
<p><a href="{{portalUrl}}" style="display:inline-block;padding:10px 20px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open my portal</a></p>
<p>If the button does not work, copy and paste this link into your browser:</p>
<p>{{portalUrl}}</p>
<p><em>This link expires in {{expirationDays}} days.</em></p>`,
    text: `Hi {{customerName}},

Here is your secure link to review work orders, estimates, and messages:
{{portalUrl}}

This link expires in {{expirationDays}} days.`,
    variables: ["customerName", "portalUrl", "expirationDays"],
  },
  {
    key: "estimate.sent",
    label: "Estimate sent to customer",
    description: "Notifies a customer that a new estimate is ready for their review.",
    subject: "Estimate {{estimateNumber}} is ready for your review",
    html: `<p>Hi {{customerName}},</p>
<p>Estimate <strong>{{estimateNumber}}</strong> for {{vehicleLabel}} is ready for your review. The total is <strong>{{total}}</strong>.</p>
<p><a href="{{estimateUrl}}" style="display:inline-block;padding:10px 20px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Review estimate</a></p>
<p>If you have questions, just reply to this email and your writer will get back to you.</p>`,
    text: `Hi {{customerName}},

Estimate {{estimateNumber}} for {{vehicleLabel}} is ready for your review. Total: {{total}}.

Review estimate: {{estimateUrl}}

Reply to this email if you have questions.`,
    variables: ["customerName", "estimateNumber", "vehicleLabel", "total", "estimateUrl"],
  },
  {
    key: "work-order.status-change",
    label: "Work order status change",
    description: "Keeps the customer in the loop when a work order status moves.",
    subject: "Work order {{workOrderNumber}} is now {{statusLabel}}",
    html: `<p>Hi {{customerName}},</p>
<p>Work order <strong>{{workOrderNumber}}</strong> for {{vehicleLabel}} is now <strong>{{statusLabel}}</strong>.</p>
<p>{{statusDetail}}</p>
<p><a href="{{workOrderUrl}}" style="display:inline-block;padding:10px 20px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open work order</a></p>`,
    text: `Hi {{customerName}},

Work order {{workOrderNumber}} for {{vehicleLabel}} is now {{statusLabel}}.

{{statusDetail}}

Open work order: {{workOrderUrl}}`,
    variables: [
      "customerName",
      "workOrderNumber",
      "vehicleLabel",
      "statusLabel",
      "statusDetail",
      "workOrderUrl",
    ],
  },
  {
    key: "training.assigned",
    label: "Training assignment notification",
    description: "Notifies a user that they have a new training assignment to complete.",
    subject: "New training assignment: {{articleTitle}}",
    html: `<p>Hi {{recipientName}},</p>
<p><strong>{{assignerName}}</strong> assigned you a training article: <strong>{{articleTitle}}</strong>.</p>
<p>{{assignmentNote}}</p>
<p><a href="{{articleUrl}}" style="display:inline-block;padding:10px 20px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Start training</a></p>`,
    text: `Hi {{recipientName}},

{{assignerName}} assigned you a training article: {{articleTitle}}.

{{assignmentNote}}

Start training: {{articleUrl}}`,
    variables: ["recipientName", "assignerName", "articleTitle", "assignmentNote", "articleUrl"],
  },
];

export type EmailTemplateSeedResult = {
  key: string;
  action: "created" | "updated" | "unchanged";
  version: number;
};

export async function ensureEmailTemplatesSeeded(
  seeds: readonly EmailTemplateSeed[] = EMAIL_TEMPLATE_SEEDS,
): Promise<EmailTemplateSeedResult[]> {
  const results: EmailTemplateSeedResult[] = [];

  for (const seed of seeds) {
    const existing = await db.emailTemplate.findUnique({ where: { key: seed.key } });

    if (!existing) {
      const created = await db.emailTemplate.create({
        data: {
          key: seed.key,
          label: seed.label,
          description: seed.description,
          subject: seed.subject,
          html: seed.html,
          text: seed.text,
          variablesJson: seed.variables,
          version: 1,
        },
      });
      results.push({ key: created.key, action: "created", version: created.version });
      continue;
    }

    if (isUnchanged(existing, seed)) {
      results.push({ key: existing.key, action: "unchanged", version: existing.version });
      continue;
    }

    const updated = await db.emailTemplate.update({
      where: { key: seed.key },
      data: {
        label: seed.label,
        description: seed.description,
        subject: seed.subject,
        html: seed.html,
        text: seed.text,
        variablesJson: seed.variables,
        version: existing.version + 1,
        deletedAt: null,
      },
    });
    results.push({ key: updated.key, action: "updated", version: updated.version });
  }

  return results;
}

function isUnchanged(
  existing: {
    label: string;
    description: string | null;
    subject: string;
    html: string;
    text: string;
    variablesJson: unknown;
    deletedAt: Date | null;
  },
  seed: EmailTemplateSeed,
): boolean {
  if (existing.deletedAt) {
    return false;
  }
  if (existing.label !== seed.label) return false;
  if ((existing.description ?? "") !== seed.description) return false;
  if (existing.subject !== seed.subject) return false;
  if (existing.html !== seed.html) return false;
  if (existing.text !== seed.text) return false;

  const existingVars = Array.isArray(existing.variablesJson)
    ? existing.variablesJson.filter((v): v is string => typeof v === "string")
    : [];
  if (existingVars.length !== seed.variables.length) return false;
  for (let i = 0; i < existingVars.length; i += 1) {
    if (existingVars[i] !== seed.variables[i]) return false;
  }
  return true;
}
