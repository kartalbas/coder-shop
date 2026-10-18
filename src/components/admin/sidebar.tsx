import Link from "next/link";
import { LogOut, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { AdminLanguageSwitcher } from "@/components/admin/language-switcher";
import { label, type LanguageConfig } from "@/lib/i18n";
import { getRequestLabels } from "@/server/i18n";
import { logoutAction } from "@/server/actions/admin/auth";

export async function AdminSidebar({
  languages,
  current,
}: {
  languages: LanguageConfig[];
  current: string;
}) {
  const labels = await getRequestLabels();
  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r bg-muted/30 max-lg:hidden">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/admin" className="flex items-center gap-2 font-bold tracking-tight">
          <Package className="size-5 text-primary" aria-hidden />
          coder-shop Admin
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label={label(labels, "admin.nav.aria")}>
        {ADMIN_NAV.map(({ href, labelKey, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Icon className="size-4" aria-hidden />
            {label(labels, labelKey)}
          </Link>
        ))}
      </nav>
      {/* Issue #58 admin slice: the language of the admin follows the shared cookie —
          the switcher writes it, one button per active language row. */}
      <div className="border-t px-3 pt-3">
        <AdminLanguageSwitcher languages={languages} current={current} />
      </div>
      {/* Issue #49: the shortcuts are discoverable right where the admin works. */}
      <p className="px-3 pb-1 pt-3 text-xs text-muted-foreground">
        <kbd className="rounded border bg-muted px-1 font-mono">⌘K</kbd>{" "}
        {label(labels, "admin.sidebar.commands")} ·{" "}
        <kbd className="rounded border bg-muted px-1 font-mono">?</kbd>{" "}
        {label(labels, "admin.sidebar.shortcuts")}
      </p>
      <form action={logoutAction} className="p-3">
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
          <LogOut className="size-4" aria-hidden />
          {label(labels, "admin.action.logout")}
        </Button>
      </form>
    </aside>
  );
}
