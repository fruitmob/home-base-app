import { Resend } from "resend";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Home Base <noreply@homebase.local>";

// Lazily instantiate Resend if we have a key
const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendEmail(message: EmailMessage): Promise<{ id?: string; error?: unknown }> {
  // 1. Production / Configured Dev -> Real Email via Resend
  if (resendClient) {
    try {
      const { data, error } = await resendClient.emails.send({
        from: EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      });

      if (error) {
        console.error("[EmailService] Resend API Error:", error);
        return { error };
      }

      return { id: data?.id };
    } catch (err) {
      console.error("[EmailService] Unexpected Error:", err);
      return { error: err };
    }
  }

  // 2. Standard Local Dev -> Console Fallback Logging
  console.log("=========================================");
  console.log("[EmailService] DEVELOPMENT EMAIL FALLBACK");
  console.log(`To:      ${Array.isArray(message.to) ? message.to.join(", ") : message.to}`);
  console.log(`Subject: ${message.subject}`);
  console.log("-----------------------------------------");
  console.log("HTML Body:");
  console.log(message.html);
  if (message.text) {
    console.log("Text Body:");
    console.log(message.text);
  }
  console.log("=========================================");
  
  // Simulate successful dispatch
  return { id: "simulated_" + Date.now().toString() };
}
