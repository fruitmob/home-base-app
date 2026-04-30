import { EmailSendStatus, Prisma, type EmailTemplate } from "@/generated/prisma/client";
import { sendEmail } from "@/lib/core/email";
import { db } from "@/lib/db";

export type TemplateVariableBag = Record<string, string | number | null | undefined>;

export type RenderedTemplate = {
  key: string;
  version: number;
  subject: string;
  html: string;
  text: string;
};

export type SendTemplatedEmailInput = {
  templateKey: string;
  to: string;
  variables: TemplateVariableBag;
  replyTo?: string;
};

export type SendTemplatedEmailResult = {
  send: { id: string; status: EmailSendStatus; providerMessageId: string | null };
  rendered: RenderedTemplate;
};

export class TemplatedEmailError extends Error {
  constructor(message: string, readonly code: "TEMPLATE_NOT_FOUND" | "MISSING_VARIABLE" | "SEND_FAILED") {
    super(message);
    this.name = "TemplatedEmailError";
  }
}

export function renderTemplate(
  template: Pick<EmailTemplate, "key" | "version" | "subject" | "html" | "text" | "variablesJson">,
  variables: TemplateVariableBag,
): RenderedTemplate {
  const declared = readDeclaredVariables(template.variablesJson);
  assertRequiredVariables(template.key, declared, variables);

  return {
    key: template.key,
    version: template.version,
    subject: interpolate(template.subject, variables, { escape: false }),
    html: interpolate(template.html, variables, { escape: true }),
    text: interpolate(template.text, variables, { escape: false }),
  };
}

export async function sendTemplatedEmail(input: SendTemplatedEmailInput): Promise<SendTemplatedEmailResult> {
  const template = await db.emailTemplate.findFirst({
    where: { key: input.templateKey, deletedAt: null },
  });

  if (!template) {
    throw new TemplatedEmailError(
      `Email template "${input.templateKey}" is not registered.`,
      "TEMPLATE_NOT_FOUND",
    );
  }

  const rendered = renderTemplate(template, input.variables);

  const sendResult = await sendEmail({
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: input.replyTo,
  });

  const status = deriveStatus(sendResult);
  const errorMessage = sendResult.error ? stringifyError(sendResult.error) : null;
  const providerMessageId = sendResult.id ?? null;

  const record = await db.emailSend.create({
    data: {
      templateKey: template.key,
      templateVersion: template.version,
      recipientEmail: input.to,
      subject: rendered.subject,
      status,
      providerMessageId,
      errorMessage,
      variablesJson: toJsonObject(input.variables),
    },
    select: { id: true, status: true, providerMessageId: true },
  });

  if (status === EmailSendStatus.FAILED) {
    throw new TemplatedEmailError(
      errorMessage ?? "Email provider rejected the send.",
      "SEND_FAILED",
    );
  }

  return { send: record, rendered };
}

function readDeclaredVariables(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function assertRequiredVariables(
  templateKey: string,
  declared: readonly string[],
  provided: TemplateVariableBag,
) {
  const missing = declared.filter((name) => {
    const value = provided[name];
    return value === null || value === undefined || (typeof value === "string" && value.length === 0);
  });

  if (missing.length > 0) {
    throw new TemplatedEmailError(
      `Template "${templateKey}" is missing required variables: ${missing.join(", ")}.`,
      "MISSING_VARIABLE",
    );
  }
}

function interpolate(
  template: string,
  variables: TemplateVariableBag,
  options: { escape: boolean },
): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      return match;
    }
    const value = variables[key];
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = String(value);
    return options.escape ? escapeHtml(stringValue) : stringValue;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deriveStatus(result: { id?: string; error?: unknown }): EmailSendStatus {
  if (result.error) {
    return EmailSendStatus.FAILED;
  }
  if (result.id && result.id.startsWith("simulated_")) {
    return EmailSendStatus.SIMULATED;
  }
  if (result.id) {
    return EmailSendStatus.SENT;
  }
  return EmailSendStatus.FAILED;
}

function toJsonObject(variables: TemplateVariableBag): Prisma.InputJsonValue {
  const entries: [string, Prisma.InputJsonValue][] = [];
  for (const [key, value] of Object.entries(variables)) {
    if (value === null || value === undefined) {
      continue;
    }
    entries.push([key, typeof value === "number" ? value : String(value)]);
  }
  return Object.fromEntries(entries) as Prisma.InputJsonValue;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown email provider error.";
  }
}
