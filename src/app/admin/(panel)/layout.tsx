import type { ReactNode } from "react";
import { connection } from "next/server";
import { AdminCommandPalette } from "@/components/admin/command-palette";
import { AdminMobileNav } from "@/components/admin/mobile-nav";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdminSession } from "@/server/session";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection();
  await requireAdminSession();
  return (
    <div className="flex min-h-screen max-lg:flex-col">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
      <AdminCommandPalette />
    </div>
  );
}
