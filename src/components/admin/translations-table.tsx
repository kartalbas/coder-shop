"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLabels } from "@/components/labels";
import {
  BASE_LANGUAGE,
  interpolate,
  isTranslated,
  label,
  needsReview,
  type LanguageConfig,
  type TranslationEntry,
} from "@/lib/i18n";
import { saveTranslationAction } from "@/server/actions/admin/translations";

// Issue #58 editor inline-editing slice: the list edits what it shows. Every text cell
// (German base + each active language) is a button that turns into an input; Enter or
// blur commits, Esc cancels, Tab walks the grid (blur commits, focus moves on). The
// save is a single-code payload over the one validated core — `saveTranslationCore`
// updates texts per code and leaves absent codes untouched, so editing one cell can
// never destroy another language's text. The full editor page stays for key/area,
// deactivated languages and new rows.

interface CellProps {
  entry: TranslationEntry;
  code: string;
  value: string;
  deValue: string;
  languageName: string;
  onSaved: (key: string, code: string, value: string) => void;
}

function EditableCell({ entry, code, value, deValue, languageName, onSaved }: CellProps) {
  const labels = useLabels();
  // Toast labels read through a ref kept current by an effect, so a label sync can
  // never re-fire a toast (address-book pattern).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Esc exits edit mode; the input's blur that follows must not commit the draft.
  const cancelling = useRef(false);
  // While editing the button is unmounted, so focus can only be restored after the
  // unmount — the flag is consumed by the effect below once editing flipped to false.
  const pendingFocus = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (pendingFocus.current) {
      pendingFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  const ariaLabel = interpolate(label(labels, "admin.translations.editCellAria"), {
    key: entry.key,
    language: languageName,
  });

  const start = () => {
    if (saving) return;
    setDraft(value);
    setEditing(true);
  };

  const commit = async (refocus: boolean) => {
    if (saving) return;
    setSaving(true);
    const payload =
      code === BASE_LANGUAGE
        ? { key: entry.key, area: entry.area, de: draft, texts: {} }
        : { key: entry.key, area: entry.area, de: deValue, texts: { [code]: draft } };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    const result = await saveTranslationAction(null, formData);
    setSaving(false);
    if (result.ok) {
      toast.success(label(labelsRef.current, "admin.translations.saved"));
      onSaved(entry.key, code, draft);
      pendingFocus.current = refocus;
      setEditing(false);
      router.refresh();
    } else if (result.error) {
      toast.error(result.error);
      inputRef.current?.focus();
    }
  };

  const cancel = () => {
    cancelling.current = true;
    pendingFocus.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        onBlur={() => {
          if (cancelling.current) {
            cancelling.current = false;
            return;
          }
          void commit(false);
        }}
        aria-label={ariaLabel}
        aria-busy={saving}
        className="w-full min-w-40 rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-ring"
      />
    );
  }

  const translated = isTranslated({ ...entry, texts: { [code]: value } }, code);
  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={start}
      aria-label={ariaLabel}
      className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {translated ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {value}
          {needsReview(entry, code) && (
            <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {label(labels, "admin.translations.needsReview")}
            </span>
          )}
        </span>
      ) : (
        <span className="text-xs italic text-amber-700 dark:text-amber-400">
          {label(labels, "admin.translations.missing")}
        </span>
      )}
    </button>
  );
}

export function TranslationsTable({
  entries,
  languages,
}: {
  entries: TranslationEntry[];
  languages: LanguageConfig[];
}) {
  const labels = useLabels();
  // Optimistic values applied on save; router.refresh() syncs the server truth
  // (badges, timestamps) right after.
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const textOf = (entry: TranslationEntry, code: string): string =>
    overrides[entry.key]?.[code] ?? (code === BASE_LANGUAGE ? entry.de : (entry.texts[code] ?? ""));
  const applySaved = (key: string, code: string, value: string) => {
    setOverrides((current) => ({ ...current, [key]: { ...current[key], [code]: value } }));
  };
  const columns = languages.filter((language) => language.code !== BASE_LANGUAGE);

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Key</th>
            <th className="px-4 py-2.5 font-medium">
              {label(labels, "admin.translations.column.de")}
            </th>
            {columns.map((language) => (
              <th key={language.code} className="px-4 py-2.5 font-medium">
                {language.label}
              </th>
            ))}
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.key} className="border-b last:border-0 align-top">
              <td className="px-4 py-2.5">
                <p className="font-mono text-xs font-semibold">{entry.key}</p>
                <Badge variant="outline" className="mt-1">
                  {label(labels, `admin.translations.area.${entry.area}`)}
                </Badge>
              </td>
              <td className="max-w-64 px-2 py-1.5">
                <EditableCell
                  entry={entry}
                  code={BASE_LANGUAGE}
                  value={textOf(entry, BASE_LANGUAGE)}
                  deValue={textOf(entry, BASE_LANGUAGE)}
                  languageName={label(labels, "admin.translations.column.de")}
                  onSaved={applySaved}
                />
              </td>
              {columns.map((language) => (
                <td key={language.code} className="max-w-64 px-2 py-1.5">
                  <EditableCell
                    entry={entry}
                    code={language.code}
                    value={textOf(entry, language.code)}
                    deValue={textOf(entry, BASE_LANGUAGE)}
                    languageName={language.label}
                    onSaved={applySaved}
                  />
                </td>
              ))}
              <td className="px-4 py-2.5 text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/translations/${encodeURIComponent(entry.key)}`}>
                    {label(labels, "admin.action.edit")}
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
