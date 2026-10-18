export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordResetConfirmForm } from "@/components/storefront/password-reset-forms";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";

interface PageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.reset.title"),
    description: label(labels, "shop.meta.reset.description"),
    robots: { index: false },
  };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps) {
  await connection();
  const [{ lang }, { token }] = await Promise.all([params, searchParams]);
  const labels = await getLabels(lang);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        {label(labels, "shop.meta.reset.title")}
      </h1>
      <Card>
        <CardContent className="p-5 sm:p-6">
          {token ? (
            <PasswordResetConfirmForm token={token} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {label(labels, "shop.auth.resetInvalid")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
