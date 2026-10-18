"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LanguageConfig } from "@/lib/i18n";
import {
  saveLanguageAction,
  type TranslationActionState,
} from "@/server/actions/admin/translations";

interface LanguageForm {
  code: string;
  label: string;
  intlLocale: string;
  position: string;
  active: boolean;
}

function toForm(language: LanguageConfig): LanguageForm {
  return {
    code: language.code,
    label: language.label,
    intlLocale: language.intlLocale,
    position: String(language.position),
    active: language.active,
  };
}

// Issue #58: languages are rows, not code — this form is what "a new language needs no
// code change" means operationally. Rows are deactivated via `active`, never deleted,
// so their texts survive a toggle (same discipline as suppliers).
export function LanguagesEditor({ languages }: { languages: LanguageConfig[] }) {
  return (
    <div className="space-y-4">
      {languages.map((language) => (
        <LanguageRow key={language.code} language={toForm(language)} isNew={false} />
      ))}
      <LanguageRow
        language={toForm({ code: "", label: "", intlLocale: "", position: 0, active: true })}
        isNew
      />
    </div>
  );
}

function LanguageRow({ language, isNew }: { language: LanguageForm; isNew: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(language);
  const [state, formAction, pending] = useActionState<TranslationActionState | null, FormData>(
    saveLanguageAction,
    null,
  );
  const announced = useRef(false);
  useEffect(() => {
    if (!state || announced.current) return;
    announced.current = true;
    if (state.ok) {
      toast.success("Sprache gespeichert");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    formData.set("payload", JSON.stringify(form));
    formAction(formData);
  };

  return (
    <Card>
      <CardContent>
        <form action={handleSubmit} className="flex flex-wrap items-end gap-3 pt-6">
          <div className="w-24 space-y-1.5">
            {isNew ? (
              <Label htmlFor="code-neu">Code</Label>
            ) : (
              <span className="block text-sm font-medium">Code</span>
            )}
            {isNew ? (
              <Input
                id="code-neu"
                value={form.code}
                onChange={(event) =>
                  setForm((f) => ({ ...f, code: event.target.value.toLowerCase() }))
                }
                placeholder="pt"
                className="font-mono"
                required
              />
            ) : (
              // The code identifies the row and never changes — plain text, not a
              // disabled input, so the editable form stays screen-reader clean.
              <p className="h-9 flex items-center font-mono text-sm" data-language-code={form.code}>
                {form.code}
              </p>
            )}
          </div>
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor={`label-${language.code || "neu"}`}>Name</Label>
            <Input
              id={`label-${language.code || "neu"}`}
              value={form.label}
              onChange={(event) => setForm((f) => ({ ...f, label: event.target.value }))}
              placeholder="Português"
              required
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor={`locale-${language.code || "neu"}`}>Intl-Locale</Label>
            <Input
              id={`locale-${language.code || "neu"}`}
              value={form.intlLocale}
              onChange={(event) => setForm((f) => ({ ...f, intlLocale: event.target.value }))}
              placeholder="pt-PT"
              required
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor={`position-${language.code || "neu"}`}>Position</Label>
            <Input
              id={`position-${language.code || "neu"}`}
              type="number"
              min={0}
              max={999}
              value={form.position}
              onChange={(event) => setForm((f) => ({ ...f, position: event.target.value }))}
              required
            />
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((f) => ({ ...f, active: event.target.checked }))}
              className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
            />
            Aktiv
          </label>
          <Button type="submit" variant={isNew ? "default" : "outline"} size="sm" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isNew ? (
              <>
                <Plus className="size-4" aria-hidden />
                Sprache anlegen
              </>
            ) : (
              "Speichern"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
