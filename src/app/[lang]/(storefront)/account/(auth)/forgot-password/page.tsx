export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordResetRequestForm } from "@/components/storefront/password-reset-forms";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/forgot-password">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.forgot.title"),
    description: label(labels, "shop.meta.forgot.description"),
    robots: { index: false },
  };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[lang]/account/forgot-password">) {
  await connection();
  const labels = await getLabels((await params).lang);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">
        {label(labels, "shop.meta.forgot.title")}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {label(labels, "shop.auth.forgotHint")}
      </p>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <PasswordResetRequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
