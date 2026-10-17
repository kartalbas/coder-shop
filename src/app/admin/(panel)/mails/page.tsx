export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { Mail } from "lucide-react";
import { MailMessageModel } from "@/models/mail-message";
import { formatDateTime } from "@/lib/format";
import { requireAdminSession } from "@/server/session";

export const metadata: Metadata = {
  title: "Mails",
  description: "Dev-Outbox — coder-shop Admin.",
};

export default async function MailsPage() {
  await connection();
  await requireAdminSession();
  const mails = await MailMessageModel.find()
    .sort({ sentAt: -1 })
    .limit(100)
    .select("to subject text sentAt")
    .lean()
    .exec();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dev-Outbox: alle E-Mails, die der Shop versendet hätte (neueste zuerst).
        </p>
      </div>

      {mails.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Mail className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Noch keine Mails</p>
          <p className="text-sm text-muted-foreground">
            Registrierungen, Bestellungen und Passwort-Links erscheinen hier.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {mails.map((mail) => (
            <li key={mail._id.toString()} className="rounded-xl border bg-card p-4">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{mail.subject}</span>
                  <span className="text-muted-foreground">
                    an {mail.to} · {formatDateTime(new Date(mail.sentAt))}
                  </span>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-sans text-xs">
                  {mail.text}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
