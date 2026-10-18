export const instant = false;

import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerLoginForm } from "@/components/storefront/customer-login-form";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";

// Issue #58 step 3: the texts come from the translation table (behind connection(),
// like the other storefront pages).
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/login">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.login.title"),
    description: label(labels, "shop.meta.login.description"),
    robots: { index: false },
  };
}

export default async function CustomerLoginPage({ params }: PageProps<"/[lang]/account/login">) {
  await connection();
  const labels = await getLabels((await params).lang);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        {label(labels, "shop.action.login")}
      </h1>
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
