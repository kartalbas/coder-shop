"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  label,
  needsReview,
  productContentKeys,
  type LanguageConfig,
  type TranslationEntry,
} from "@/lib/i18n";
import {
  saveProductContentAction,
  type ProductActionState,
} from "@/server/actions/admin/products";
import type { ProductDto } from "@/server/search";

// Issue #58 step B2: the product form edits the per-language name and description
// where the content lives. The document stays the German truth — the placeholder of
// every field is the document's German value (the visible fallback), and the action
// sends it as the row's `de`, so the base can never drift. One save button, one
// payload, the one validated core; a blank field clears that text again. A sixth
// language appears as one more block here without a code change — the section only
// iterates the active language rows.

interface Draft {
  name: string;
  description: string;
}

export function ProductContentTranslations({
  product,
  rows,
  languages,
}: {
  product: ProductDto;
  rows: TranslationEntry[];
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
  const keys = productContentKeys(product.slug);
  const nameRow = rows.find((row) => row.key === keys.name);
  const descriptionRow = rows.find((row) => row.key === keys.description);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      languages.map((language) => [
        language.code,
        {
          name: nameRow?.texts[language.code] ?? "",
          description: descriptionRow?.texts[language.code] ?? "",
        },
      ]),
    ),
  );
  const [state, formAction, pending] = useActionState<ProductActionState | null, FormData>(
    saveProductContentAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(label(labelsRef.current, "admin.contentTranslations.saved"));
      // Sync the review badges and stamps the save moved on the server.
      router.refresh();
    }
  }, [state, router]);

  const setDraft = (code: string, field: keyof Draft, value: string) =>
    setDrafts((current) => ({ ...current, [code]: { ...current[code], [field]: value } }));

  const handleSubmit = (formData: FormData) => {
    formData.set("payload", JSON.stringify({ texts: drafts }));
    return formAction(formData);
  };

  const reviewChip = (row: TranslationEntry | undefined, code: string) =>
    row && needsReview(row, code) ? (
      <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
        {label(labels, "admin.translations.needsReview")}
      </span>
    ) : null;

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="productId" value={product.id} />
      {languages.map((language) => {
        const translated = Boolean(
          nameRow?.texts[language.code]?.trim() || descriptionRow?.texts[language.code]?.trim(),
        );
        return (
        <fieldset key={language.code} className="space-y-3 rounded-lg border p-4">
          <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
            {language.label}
            {reviewChip(nameRow, language.code) ?? reviewChip(descriptionRow, language.code)}
            {!translated && (
              <span className="text-xs italic text-amber-700 dark:text-amber-400">
                {label(labels, "admin.translations.missing")}
              </span>
            )}
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor={`content-${language.code}-name`}>
              {label(labels, "admin.field.name")}
            </Label>
            <Input
              id={`content-${language.code}-name`}
              value={drafts[language.code]?.name ?? ""}
              onChange={(event) => setDraft(language.code, "name", event.target.value)}
              placeholder={product.name}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`content-${language.code}-description`}>
              {label(labels, "shop.product.description")}
            </Label>
            <textarea
              id={`content-${language.code}-description`}
              rows={3}
              value={drafts[language.code]?.description ?? ""}
              onChange={(event) => setDraft(language.code, "description", event.target.value)}
              placeholder={product.description}
              maxLength={2000}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
        </fieldset>
        );
      })}
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "admin.action.save")}
      </Button>
    </form>
  );
}
