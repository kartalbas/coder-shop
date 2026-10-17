import type { ReactNode } from "react";
import { connection } from "next/server";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdminSession } from "@/server/session";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection();
  await requireAdminSession();
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
