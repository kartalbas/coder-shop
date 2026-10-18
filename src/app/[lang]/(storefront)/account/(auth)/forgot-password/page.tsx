import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordResetRequestForm } from "@/components/storefront/password-reset-forms";

export const metadata: Metadata = {
  title: "Passwort vergessen",
  description: "Link zum Passwort-Zurücksetzen anfordern — coder-shop.",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Passwort vergessen</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Wir senden Ihnen einen Link zum Zurücksetzen — gültig für eine Stunde.
      </p>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <PasswordResetRequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
