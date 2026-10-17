import type { Metadata } from "next";
import { Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/admin/login-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Admin-Anmeldung",
  description: "Anmeldung für den coder-shop Admin-Bereich.",
};

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Package className="size-6 text-primary" aria-hidden />
        </div>
        <CardTitle>coder-shop Admin</CardTitle>
        <CardDescription>Melden Sie sich mit Ihrem Admin-Konto an.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        {process.env.NODE_ENV !== "production" && (
          <p className="rounded-lg bg-muted p-3 text-center text-xs text-muted-foreground">
            Demo-Zugang: admin@codershop.ch — das Passwort kommt aus dem Seed
            (<code>ADMIN_PASSWORD</code> bzw. dessen Ausgabe).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
