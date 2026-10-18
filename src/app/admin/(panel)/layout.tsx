import type { ReactNode } from "react";
import { connection } from "next/server";
import { AdminCommandPalette } from "@/components/admin/command-palette";
import { AdminMobileNav } from "@/components/admin/mobile-nav";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdminSession } from "@/server/session";
import { getActiveLanguages, getRequestLanguage } from "@/server/i18n";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection();
  await requireAdminSession();
  // Issue #58 admin slice: the active language rows drive the switcher; the current
  // language is the one the root layout resolved from the shared cookie.
  const [languages, current] = await Promise.all([getActiveLanguages(), getRequestLanguage()]);
  return (
    <div className="flex min-h-screen max-lg:flex-col">
      <AdminSidebar languages={languages} current={current} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav languages={languages} current={current} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
      <AdminCommandPalette />
    </div>
  );
}
