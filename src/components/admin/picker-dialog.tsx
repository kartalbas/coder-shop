"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

// Command-palette style picker (issue #42): type to search instantly, ↑/↓ through the
// list, Enter selects, Esc closes, focus stays inside while open and returns to the
// opener afterwards (the Radix Dialog provides the focus trap and the restore).
// One dialog implementation for every admin pick — variants, suppliers, …

export interface PickerItem {
  id: string;
  // The text the match is highlighted in (usually the primary label).
  primary: string;
  secondary?: string;
  meta?: string;
  imageSrc?: string;
}

// Case-insensitive highlight of `query` inside `text`.
function highlight(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-primary/20 text-inherit">
        {text.slice(index, index + trimmed.length)}
      </mark>
      {text.slice(index + trimmed.length)}
    </>
  );
}

// Mounted fresh every time the dialog opens — the content unmounts as soon as `open`
// goes false (Radix itself keeps it mounted through the exit animation, which would
// otherwise let a quick reopen carry the old query over), so the query/result state
// starts empty without any reset effect.
function PickerContent({
  search,
  onSelect,
  placeholder,
  title,
  minChars = 2,
}: {
  search: (query: string) => Promise<PickerItem[]>;
  onSelect: (item: PickerItem) => void;
  placeholder: string;
  title: string;
  // Command palette searches from one character (issue #49); pickers keep two.
  minChars?: number;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; items: PickerItem[] } | null>(null);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query, 200);
  const listRef = useRef<HTMLUListElement>(null);
  const trimmed = debounced.trim();

  useEffect(() => {
    if (trimmed.length < minChars) return;
    let cancelled = false;
    search(trimmed)
      .then((items) => {
        if (cancelled) return;
        setResult({ query: trimmed, items });
        setActive(0);
      })
      .catch(() => {
        if (!cancelled) setResult({ query: trimmed, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, search, minChars]);

  // Results only count for the query they were fetched with — a stale list never
  // flashes while a new search is in flight.
  const options = result?.query === trimmed ? result.items : [];
  const searching = trimmed.length >= minChars && options.length === 0 && result?.query !== trimmed;
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));

  // Keep the active option in view when the arrows move past the scroll window.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, options.length]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      setActive(
        event.key === "ArrowDown"
          ? (activeIndex + 1) % options.length
          : (activeIndex - 1 + options.length) % options.length,
      );
    } else if (event.key === "Home" && options.length > 0) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && options.length > 0) {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = options[activeIndex];
      if (item) onSelect(item);
    }
  }

  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="pl-8"
          autoComplete="off"
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            options.length > 0 ? `${listId}-option-${activeIndex}` : undefined
          }
        />
      </div>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={title}
        className="max-h-72 overflow-y-auto rounded-md border"
      >
        {searching && (
          <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Suche…
          </li>
        )}
        {!searching && options.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground" role="status">
            {trimmed.length >= minChars
              ? `Keine Treffer für „${trimmed}“.`
              : `Mindestens ${minChars} Zeichen tippen.`}
          </li>
        )}
        {options.map((item, index) => (
          <li
            key={item.id}
            id={`${listId}-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => setActive(index)}
            onClick={() => onSelect(item)}
            className={cn(
              "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
              index === activeIndex && "bg-accent text-accent-foreground",
            )}
          >
            {item.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin picker rows, optimizer adds nothing here
              <img
                src={item.imageSrc}
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0 rounded border object-contain"
              />
            ) : (
              <span className="size-8 shrink-0 rounded border bg-muted" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {highlight(item.primary, trimmed)}
              </span>
              {item.secondary && (
                <span className="block truncate text-xs text-muted-foreground">
                  {highlight(item.secondary, trimmed)}
                </span>
              )}
            </span>
            {item.meta && (
              <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function PickerDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  search,
  onSelect,
  minChars,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  search: (query: string) => Promise<PickerItem[]>;
  onSelect: (item: PickerItem) => void;
  minChars?: number;
}) {
  // Close on selection and hand control back to the caller.
  const handleSelect = useCallback(
    (item: PickerItem) => {
      onSelect(item);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  // The opener gets focus back when the dialog closes (issue #42: keyboard flow
  // continues exactly where it started). Radix's own restore does not fire reliably
  // for a controlled dialog whose content unmounts behind an exit animation, so the
  // opener is remembered on open and refocused on close.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }
    const opener = openerRef.current;
    openerRef.current = null;
    if (!opener?.isConnected) return;
    const frame = requestAnimationFrame(() => opener.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Tippen sucht sofort — ↑/↓ wählen, Enter übernimmt, Esc bricht ab.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PickerContent
            title={title}
            placeholder={placeholder}
            search={search}
            onSelect={handleSelect}
            minChars={minChars}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
