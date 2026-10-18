"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { PickerDialog, type PickerItem } from "@/components/admin/picker-dialog";
import { commandSearchAction } from "@/server/actions/admin/command-palette";
import { useLabels } from "@/components/labels";
import { interpolate, label } from "@/lib/i18n";
import type { PaletteGroup } from "@/server/command-palette";

// Admin command palette (issue #49): ⌘K / Ctrl+K anywhere in the admin opens the
// picker-based search over orders, products, customers and suppliers plus the pages
// and actions themselves; "?" opens an overlay listing the shortcuts.
// #58 step 5: the palette's own strings are rows too — kinds and groups travel as
// machine keys and render through the label map.

// The keycap labels stay as printed keys (⌘K, ↑/↓, …) — they are keys, not texts.
const SHORTCUTS: { keys: string; actionKey: string }[] = [
  { keys: "⌘K / Strg+K", actionKey: "admin.palette.shortcuts.open" },
  { keys: "?", actionKey: "admin.palette.shortcuts.help" },
  { keys: "↑ / ↓", actionKey: "admin.palette.shortcuts.move" },
  { keys: "Enter", actionKey: "admin.palette.shortcuts.select" },
  { keys: "Esc", actionKey: "admin.palette.shortcuts.close" },
];

// Entity groups and local kinds map to the rows that name them.
const GROUP_LABEL_KEYS: Record<PaletteGroup, string> = {
  orders: "admin.orders.title",
  products: "admin.products.title",
  customers: "admin.customers.title",
  suppliers: "admin.suppliers.title",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function AdminCommandPalette() {
  const router = useRouter();
  const labels = useLabels();
  const localCommands = useMemo(
    () => [
      {
        label: label(labels, "admin.palette.action.newPurchaseOrder"),
        href: "/admin/purchasing",
        kindKey: "admin.palette.kind.action",
      },
      ...ADMIN_NAV.map((entry) => ({
        label: label(labels, entry.labelKey),
        href: entry.href,
        kindKey: "admin.palette.kind.page",
      })),
    ],
    [labels],
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === "?" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    // Signal that the shortcuts are live (hydrated) — used by the e2e specs so they
    // never press keys against the not-yet-hydrated server HTML.
    document.body.dataset.commandPalette = "ready";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      delete document.body.dataset.commandPalette;
    };
  }, []);

  // Local pages/actions match instantly, entity hits come from the server.
  const search = useCallback(async (query: string): Promise<PickerItem[]> => {
    const q = query.trim().toLowerCase();
    const local = localCommands.filter((command) => command.label.toLowerCase().includes(q));
    const remote = await commandSearchAction(query);
    return [
      ...local.map((command) => ({
        id: command.href,
        primary: command.label,
        meta: label(labels, command.kindKey),
      })),
      ...remote.map((hit) => ({
        id: hit.href,
        primary: hit.primary,
        ...(hit.secondary !== undefined && { secondary: hit.secondary }),
        ...(hit.leadTimeDays !== undefined && {
          secondary: interpolate(label(labels, "admin.palette.supplierLeadTime"), {
            days: hit.leadTimeDays,
          }),
        }),
        meta: label(labels, GROUP_LABEL_KEYS[hit.group]),
      })),
    ];
  }, [localCommands, labels]);

  function onSelect(item: PickerItem): void {
    router.push(item.id);
  }

  return (
    <>
      <PickerDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title={label(labels, "admin.palette.title")}
        placeholder={label(labels, "admin.palette.placeholder")}
        search={search}
        onSelect={onSelect}
        minChars={1}
      />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md" data-testid="shortcuts-overlay">
          <DialogHeader>
            <DialogTitle>{label(labels, "admin.palette.shortcuts.title")}</DialogTitle>
            <DialogDescription>{label(labels, "admin.palette.shortcuts.description")}</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-4">
                <dt>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {shortcut.keys}
                  </kbd>
                </dt>
                <dd className="text-right text-muted-foreground">
                  {label(labels, shortcut.actionKey)}
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
