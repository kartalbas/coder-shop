export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { Mail } from "lucide-react";
import { MailMessageModel } from "@/models/mail-message";
import { interpolate, label } from "@/lib/i18n";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";
import { requireAdminSession } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.mails.title"),
    description: label(labels, "admin.meta.mails.description"),
  };
}

export default async function MailsPage() {
  await connection();
  await requireAdminSession();
  const [mails, labels] = await Promise.all([
    MailMessageModel.find()
      .sort({ sentAt: -1 })
      .limit(100)
      .select("to subject text sentAt")
      .lean()
      .exec(),
    getRequestLabels(),
  ]);
  const f = await getRequestFormatters();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.mails.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{label(labels, "admin.mails.intro")}</p>
      </div>

      {mails.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Mail className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">{label(labels, "admin.mails.empty")}</p>
          <p className="text-sm text-muted-foreground">{label(labels, "admin.mails.emptyNote")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {mails.map((mail) => (
            <li key={mail._id.toString()} className="rounded-xl border bg-card p-4">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{mail.subject}</span>
                  <span className="text-muted-foreground">
                    {interpolate(label(labels, "admin.mails.to"), {
                      to: mail.to,
                      time: f.dateTime(new Date(mail.sentAt)),
                    })}
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
