import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerLoginForm } from "@/components/storefront/customer-login-form";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Mit Ihrem Kundenkonto anmelden — coder-shop.",
  robots: { index: false },
};

export default function CustomerLoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Anmelden</h1>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <Suspense>
            <CustomerLoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
