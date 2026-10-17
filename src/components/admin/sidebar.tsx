import Link from "next/link";
import { LogOut, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { logoutAction } from "@/server/actions/admin/auth";

export function AdminSidebar() {
  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r bg-muted/30 max-lg:hidden">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/admin" className="flex items-center gap-2 font-bold tracking-tight">
          <Package className="size-5 text-primary" aria-hidden />
          coder-shop Admin
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Admin-Navigation">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <form action={logoutAction} className="border-t p-3">
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
          <LogOut className="size-4" aria-hidden />
          Abmelden
        </Button>
      </form>
    </aside>
  );
}
