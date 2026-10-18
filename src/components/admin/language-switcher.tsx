"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLabels } from "@/components/labels";
import { interpolate, label, type LanguageConfig } from "@/lib/i18n";
import { setLanguageAction } from "@/server/actions/admin/language";

// Issue #58 admin slice: one button per active language row — the set is data, so a
// sixth language appears here without a code change. The click writes the shared
// `lang` cookie through the server action and refreshes the route, which re-resolves
// the whole admin (layout, nav, messages) in the new language.
export function AdminLanguageSwitcher({
  languages,
  current,
}: {
  languages: LanguageConfig[];
  current: string;
}) {
  const router = useRouter();
  const labels = useLabels();

  return (
    <div
      className="flex flex-wrap gap-1"
      role="group"
      aria-label={label(labels, "admin.language.aria")}
    >
      {languages.map((language) => (
        <Button
          key={language.code}
          type="button"
          variant="ghost"
          size="sm"
          className="px-2 text-xs"
          aria-pressed={language.code === current}
          // `title`, not `aria-label`: the visible language name stays the accessible
          // name, and the translations editor's getByLabel(/<language>/) fields — on a
          // page that carries this sidebar — keep matching exactly one control.
          title={interpolate(label(labels, "admin.language.switchTo"), {
            language: language.label,
          })}
          onClick={() => {
            void setLanguageAction(language.code).then(() => router.refresh());
          }}
        >
          {language.label}
        </Button>
      ))}
    </div>
  );
}
