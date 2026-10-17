import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterForm } from "@/components/storefront/register-form";

export const metadata: Metadata = {
  title: "Registrieren",
  description: "Kundenkonto erstellen — coder-shop.",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Konto erstellen</h1>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}
