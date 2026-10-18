"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { AdminLanguageSwitcher } from "@/components/admin/language-switcher";
import { useLabels } from "@/components/labels";
import { label, type LanguageConfig } from "@/lib/i18n";
import { logoutAction } from "@/server/actions/admin/auth";

export function AdminMobileNav({
  languages,
  current,
}: {
  languages: LanguageConfig[];
  current: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const labels = useLabels();

  return (
    <div className="no-print sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={label(labels, "admin.mobile.openNav")}>
            <Menu className="size-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-64 flex-col gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Package className="size-5 text-primary" aria-hidden />
              coder-shop Admin
            </SheetTitle>
          </SheetHeader>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={label(labels, "admin.nav.aria")}>
            {ADMIN_NAV.map(({ href, labelKey, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={pathname === href ? "page" : undefined}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
              >
                <Icon className="size-4" aria-hidden />
                {label(labels, labelKey)}
              </Link>
            ))}
          </nav>
          <div className="border-t px-3 pt-3">
            <AdminLanguageSwitcher languages={languages} current={current} />
          </div>
          <form action={logoutAction} className="p-3">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
              <LogOut className="size-4" aria-hidden />
              {label(labels, "admin.action.logout")}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
      <Link
        href="/admin"
        className="flex items-center gap-2 text-sm font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Package className="size-4 text-primary" aria-hidden />
        coder-shop Admin
      </Link>
    </div>
  );
}
