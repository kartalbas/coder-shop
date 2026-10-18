"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BASE_LANGUAGE,
  TRANSLATION_AREAS,
  type LanguageConfig,
  type TranslationArea,
  type TranslationEntry,
} from "@/lib/i18n";
import {
  saveTranslationAction,
  type TranslationActionState,
} from "@/server/actions/admin/translations";

const AREA_LABELS: Record<TranslationArea, string> = {
  shop: "Shop",
  admin: "Admin",
  mail: "Mails",
  invoice: "Rechnungen",
  catalog: "Katalog",
};

// Issue #58: one row of the translation table — the German base text is required,
// every language column is optional (blank = missing, answers German until translated).
export function TranslationEditor({
  entry,
  languages,
}: {
  entry: TranslationEntry | null;
  languages: LanguageConfig[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    key: entry?.key ?? "",
    area: entry?.area ?? ("shop" as TranslationArea),
    de: entry?.de ?? "",
  });
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(
      languages.map((language) => [language.code, entry?.texts[language.code] ?? ""]),
    ),
  );
  const [state, formAction, pending] = useActionState<TranslationActionState | null, FormData>(
    saveTranslationAction,
    null,
  );
  const announced = useRef(false);
  useEffect(() => {
    if (!state || announced.current) return;
    announced.current = true;
    if (state.ok) {
      toast.success("Übersetzung gespeichert");
      router.push("/admin/translations");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  // Every rendered language code is sent with its raw value (#58 review): an empty
  // string says "clear this text", a code that was never rendered is left untouched by
  // the core — deactivated languages' texts survive every edit of a row.
  const handleSubmit = (formData: FormData) => {
    const payloadTexts: Record<string, string> = {};
    for (const [code, text] of Object.entries(texts)) {
      if (code !== BASE_LANGUAGE) payloadTexts[code] = text;
    }
    formData.set(
      "payload",
      JSON.stringify({ key: form.key, area: form.area, de: form.de, texts: payloadTexts }),
    );
    formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="translation-key">Key</Label>
              <Input
                id="translation-key"
                value={form.key}
                onChange={(event) => setForm((f) => ({ ...f, key: event.target.value }))}
                readOnly={entry !== null}
                placeholder="shop.cart.title"
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Bereich.Key in Kleinbuchstaben — eindeutig über alle Texte.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="translation-area">Bereich</Label>
              <Select
                value={form.area}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, area: value as TranslationArea }))
                }
              >
                <SelectTrigger id="translation-area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSLATION_AREAS.map((area) => (
                    <SelectItem key={area} value={area}>
                      {AREA_LABELS[area]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="translation-de">Deutsch (Basis, Pflicht)</Label>
            <Textarea
              id="translation-de"
              value={form.de}
              onChange={(event) => setForm((f) => ({ ...f, de: event.target.value }))}
              rows={2}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm font-medium">Übersetzungen</p>
          <p className="text-xs text-muted-foreground">
            Leer lassen heisst «fehlt» — der Text antwortet dann sichtbar auf Deutsch,
            bis er übersetzt ist.
          </p>
          {languages
            .filter((language) => language.code !== BASE_LANGUAGE)
            .map((language) => (
              <div key={language.code} className="space-y-1.5">
                <Label htmlFor={`translation-${language.code}`}>
                  {language.label}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {language.code}
                  </span>
                  {!language.active && (
                    <span className="ml-1 text-xs text-muted-foreground">(deaktiviert)</span>
                  )}
                </Label>
                <Input
                  id={`translation-${language.code}`}
                  value={texts[language.code] ?? ""}
                  onChange={(event) =>
                    setTexts((t) => ({ ...t, [language.code]: event.target.value }))
                  }
                />
              </div>
            ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Speichern
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/translations")}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
