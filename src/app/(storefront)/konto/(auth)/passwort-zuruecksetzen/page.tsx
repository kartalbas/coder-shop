export const instant = false;

import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordResetConfirmForm } from "@/components/storefront/password-reset-forms";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen",
  description: "Neues Passwort setzen — coder-shop.",
  robots: { index: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Passwort zurücksetzen</h1>
      <Card>
        <CardContent className="p-5 sm:p-6">
          {token ? (
            <PasswordResetConfirmForm token={token} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Dieser Link ist ungültig. Bitte fordern Sie über „Passwort vergessen“ einen
              neuen an.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
