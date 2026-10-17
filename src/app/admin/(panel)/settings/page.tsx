export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { ShopSettingsForm } from "@/components/admin/shop-settings-form";
import { getShopSettings } from "@/server/shop-settings";

export const metadata: Metadata = {
  title: "Einstellungen — Admin",
  description: "MwSt., Versandarten und Zahlungsarten als Konfiguration.",
};

export default async function SettingsPage() {
  await connection();
  const settings = await getShopSettings();
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        MwSt.-Satz, Versandpreise und Zahlungsarten sind Konfiguration — Änderungen wirken
        sofort im Shop, ohne Code-Änderung.
      </p>
      <div className="mt-6">
        <ShopSettingsForm settings={settings} />
      </div>
    </div>
  );
}
