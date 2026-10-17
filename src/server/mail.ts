import { MailMessageModel } from "@/models/mail-message";
import type { MailContent } from "@/lib/mail-templates";
import { connectDB } from "./db";

// Issue #39/#44: every workflow mail goes through sendMail. Without a real transport
// configured the dev outbox stores the message so it can be read under /admin/mails.
export interface MailMessage extends MailContent {
  to: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  await connectDB();
  await MailMessageModel.create({
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    sentAt: new Date(),
  });
}
