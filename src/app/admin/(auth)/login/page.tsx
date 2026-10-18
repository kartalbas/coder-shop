import type { Metadata } from "next";
import { connection } from "next/server";
import { Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/admin/login-form";
import { label, splitOnPlaceholder } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";

export const instant = false;

// Issue #58 admin slice: the login answers in the remembered language (cookie >
// browser > first active row) — generateMetadata behind connection() reads the table
// per request, the same pattern as the account layout.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.login.title"),
    description: label(labels, "admin.login.description"),
  };
}

export default async function LoginPage() {
  await connection();
  const labels = await getRequestLabels();
  const demoHint = splitOnPlaceholder(label(labels, "admin.login.demoHint"), "var");
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Package className="size-6 text-primary" aria-hidden />
        </div>
        <CardTitle>coder-shop Admin</CardTitle>
        <CardDescription>{label(labels, "admin.login.cardIntro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        {process.env.NODE_ENV !== "production" && (
          <p className="rounded-lg bg-muted p-3 text-center text-xs text-muted-foreground">
            {demoHint.before}
            <code>ADMIN_PASSWORD</code>
            {demoHint.after}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
