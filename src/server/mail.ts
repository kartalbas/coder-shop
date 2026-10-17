import { createTransport, type Transporter } from "nodemailer";
import { MailMessageModel } from "@/models/mail-message";
import type { MailContent } from "@/lib/mail-templates";
import { connectDB } from "./db";
import { env } from "./env";

// Issue #44: every workflow mail goes through sendMail, which hands the message to a
// transport behind an interface — the dev outbox (stored, readable under /admin/mails)
// or real SMTP delivery once SMTP_HOST/SMTP_FROM are configured.
export interface MailMessage extends MailContent {
  to: string;
}

export interface MailTransport {
  readonly name: "outbox" | "smtp";
  send(message: MailMessage): Promise<void>;
}

// Pure so the selection is unit-testable without env or DB.
export function selectTransportName(smtpConfigured: boolean): MailTransport["name"] {
  return smtpConfigured ? "smtp" : "outbox";
}

const outboxTransport: MailTransport = {
  name: "outbox",
  async send(message) {
    await connectDB();
    await MailMessageModel.create({
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      sentAt: new Date(),
    });
  },
};

// The transporter is created once per process (nodemailer pools connections itself).
let smtpTransporter: Transporter | null = null;

const smtpTransport: MailTransport = {
  name: "smtp",
  async send(message) {
    smtpTransporter ??= createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ? Number(env.SMTP_PORT) : 587,
      secure: env.SMTP_PORT === "465",
      ...(env.SMTP_USER && {
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" },
      }),
    });
    await smtpTransporter.sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  },
};

function getMailTransport(): MailTransport {
  return selectTransportName(env.smtpEnabled) === "smtp" ? smtpTransport : outboxTransport;
}

export async function sendMail(message: MailMessage): Promise<void> {
  await getMailTransport().send(message);
}
