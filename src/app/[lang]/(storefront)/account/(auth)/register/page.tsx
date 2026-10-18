export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterForm } from "@/components/storefront/register-form";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/register">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.register.title"),
    description: label(labels, "shop.meta.register.description"),
    robots: { index: false },
  };
}

export default async function RegisterPage({ params }: PageProps<"/[lang]/account/register">) {
  await connection();
  const labels = await getLabels((await params).lang);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        {label(labels, "shop.action.register")}
      </h1>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}
