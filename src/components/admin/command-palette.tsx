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
import { label } from "@/lib/i18n";

// Admin command palette (issue #49): ⌘K / Ctrl+K anywhere in the admin opens the
// picker-based search over orders, products, customers and suppliers plus the pages
// and actions themselves; "?" opens an overlay listing the shortcuts.

interface LocalCommand {
  label: string;
  href: string;
  kind: "Seite" | "Aktion";
}

const LOCAL_ACTIONS: LocalCommand[] = [
  { label: "Neue Einkaufsbestellung", href: "/admin/purchasing", kind: "Aktion" },
];

const SHORTCUTS = [
  { keys: "⌘K / Strg+K", action: "Befehlspalette öffnen" },
  { keys: "?", action: "Diese Übersicht öffnen" },
  { keys: "↑ / ↓", action: "Ergebnis wählen" },
  { keys: "Enter", action: "Gewähltes Ergebnis öffnen" },
  { keys: "Esc", action: "Schliessen" },
];

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
  // #58 admin slice: the page entries follow the request language through the label
  // map; the palette's own strings are the recorded step-5 area.
  const labels = useLabels();
  const localCommands = useMemo<LocalCommand[]>(
    () => [
      ...LOCAL_ACTIONS,
      ...ADMIN_NAV.map((entry) => ({
        label: label(labels, entry.labelKey),
        href: entry.href,
        kind: "Seite" as const,
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
        meta: command.kind,
      })),
      ...remote.map((hit) => ({
        id: hit.href,
        primary: hit.primary,
        ...(hit.secondary !== undefined && { secondary: hit.secondary }),
        meta: hit.group,
      })),
    ];
  }, [localCommands]);

  function onSelect(item: PickerItem): void {
    router.push(item.id);
  }

  return (
    <>
      <PickerDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title="Befehle"
        placeholder="Bestellung, Produkt, Kunde, Lieferant oder Seite suchen…"
        search={search}
        onSelect={onSelect}
        minChars={1}
      />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md" data-testid="shortcuts-overlay">
          <DialogHeader>
            <DialogTitle>Tastaturkürzel</DialogTitle>
            <DialogDescription>Der Admin ist komplett ohne Maus bedienbar.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-4">
                <dt>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {shortcut.keys}
                  </kbd>
                </dt>
                <dd className="text-right text-muted-foreground">{shortcut.action}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
