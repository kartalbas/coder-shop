export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { ShopSettingsForm } from "@/components/admin/shop-settings-form";
import { label } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { getShopSettings } from "@/server/shop-settings";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.settings.title"),
    description: label(labels, "admin.meta.settings.description"),
  };
}

export default async function SettingsPage() {
  await connection();
  const [settings, labels] = await Promise.all([getShopSettings(), getRequestLabels()]);
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.settings.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{label(labels, "admin.settings.intro")}</p>
      <div className="mt-6">
        <ShopSettingsForm settings={settings} />
      </div>
    </div>
  );
}
