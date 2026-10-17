import mongoose, { Schema } from "mongoose";

// Dev outbox (issue #39/#44): every mail the shop would send is stored here when no real
// transport is configured, so workflows can be verified under /admin/mails.
export interface MailMessage {
  _id: mongoose.Types.ObjectId;
  to: string;
  subject: string;
  html: string;
  text: string;
  sentAt: Date;
}

const mailMessageSchema = new Schema<MailMessage>(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },
    sentAt: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

mailMessageSchema.index({ sentAt: -1 });

export const MailMessageModel =
  mongoose.models.MailMessage ??
  mongoose.model<MailMessage>("MailMessage", mailMessageSchema);
