"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTranslated, label, needsReview, type LanguageConfig, type TranslationEntry } from "@/lib/i18n";
import {
  saveCatalogTypeLabelAction,
  type CatalogTypeActionState,
} from "@/server/actions/admin/catalog-types";

// Issue #58 step B2: the type editor edits the label's translations where the type
// lives — one input per active non-base language, the configured label as the visible
// fallback (placeholder). The action always sends the stored config label as the row's
// `de` (the configuration is the German truth); dimension and value labels stay
// editable in the general translations editor.

export function CatalogTypeTranslations({
  typeKey,
  germanLabel,
  row,
  languages,
}: {
  typeKey: string;
  germanLabel: string;
  row: TranslationEntry | null;
  languages: LanguageConfig[];
}) {
  const labels = useLabels();
  // The toast fires from the action-state effect; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast (address-book).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(languages.map((language) => [language.code, row?.texts[language.code] ?? ""])),
  );
  const [state, formAction, pending] = useActionState<CatalogTypeActionState | null, FormData>(
    saveCatalogTypeLabelAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(label(labelsRef.current, "admin.contentTranslations.saved"));
      router.refresh();
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    formData.set("payload", JSON.stringify({ key: typeKey, texts: drafts }));
    return formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{label(labels, "admin.contentTranslations.heading")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {languages.map((language) => (
          <div key={language.code} className="space-y-1.5">
            <Label htmlFor={`type-label-${language.code}`} className="flex items-center gap-2">
              {language.label}
              {row && needsReview(row, language.code) && (
                <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {label(labels, "admin.translations.needsReview")}
                </span>
              )}
              {row && !isTranslated(row, language.code) && (
                <span className="text-xs italic text-amber-700 dark:text-amber-400">
                  {label(labels, "admin.translations.missing")}
                </span>
              )}
            </Label>
            <Input
              id={`type-label-${language.code}`}
              value={drafts[language.code] ?? ""}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [language.code]: event.target.value }))
              }
              placeholder={germanLabel}
              maxLength={200}
            />
          </div>
        ))}
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "admin.action.save")}
      </Button>
    </form>
  );
}
