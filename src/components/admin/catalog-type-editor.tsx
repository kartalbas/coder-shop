"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import type { CatalogTypeConfig, FacetOrder, StockTracking } from "@/lib/catalog-types";
import {
  saveCatalogTypeAction,
  type CatalogTypeActionState,
} from "@/server/actions/admin/catalog-types";

interface DimensionRow {
  key: string;
  label: string;
  facet: boolean;
  order: FacetOrder;
  unit: string;
}

const ORDER_LABELS: Record<FacetOrder, string> = {
  alpha: "Alphabetisch",
  numeric: "Numerisch",
  "clothing-size": "Kleidergrössen (XS–XXL)",
};

// Issue #64: the admin editor for the #61 catalog type configuration — types, labels,
// positions, dimensions, stock tracking, comparison flag, photo noun and brands.
export function CatalogTypeEditor({ config }: { config: CatalogTypeConfig }) {
  const router = useRouter();
  const [form, setForm] = useState({
    key: config.key,
    label: config.label,
    position: String(config.position),
    stockTracking: config.stockTracking,
    comparable: config.comparable,
    photoNoun: config.photoNoun,
    brands: config.brands.join(", "),
  });
  const [dimensions, setDimensions] = useState<DimensionRow[]>(
    config.dimensions.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      facet: dimension.facet,
      order: dimension.order,
      unit: dimension.unit ?? "",
    })),
  );
  const [state, formAction, pending] = useActionState<CatalogTypeActionState | null, FormData>(
    saveCatalogTypeAction,
    null,
  );
  const announced = useRef(false);
  useEffect(() => {
    if (!state || announced.current) return;
    announced.current = true;
    if (state.ok) {
      toast.success("Katalogtyp gespeichert");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    formData.set(
      "payload",
      JSON.stringify({
        key: form.key,
        label: form.label,
        position: form.position,
        stockTracking: form.stockTracking,
        comparable: form.comparable,
        photoNoun: form.photoNoun,
        brands: form.brands
          .split(",")
          .map((brand) => brand.trim())
          .filter(Boolean),
        dimensions,
      }),
    );
    return formAction(formData);
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="typeKey">Key (Product-Type)</Label>
            <Input id="typeKey" value={form.key} onChange={(event) => set("key", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typeLabel">Name</Label>
            <Input id="typeLabel" value={form.label} onChange={(event) => set("label", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typePosition">Position</Label>
            <Input
              id="typePosition"
              value={form.position}
              onChange={(event) => set("position", event.target.value)}
              inputMode="numeric"
              className="max-w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typeStock">Lagerführung</Label>
            <Select
              value={form.stockTracking}
              onValueChange={(value) => set("stockTracking", value as StockTracking)}
            >
              <SelectTrigger id="typeStock">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quantity">Stückzahl</SelectItem>
                <SelectItem value="serial">Seriennummern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typePhotoNoun">Foto-Beschreibung (Englisch)</Label>
            <Input
              id="typePhotoNoun"
              value={form.photoNoun}
              onChange={(event) => set("photoNoun", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typeBrands">Marken (Komma-getrennt)</Label>
            <Input id="typeBrands" value={form.brands} onChange={(event) => set("brands", event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.comparable}
              onChange={(event) => set("comparable", event.target.checked)}
              className="size-4 accent-primary"
            />
            Im Vergleich vergleichbar
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">Varianten-Dimensionen</h2>
          {dimensions.map((row, index) => (
            <div key={index} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_180px_110px_auto_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <Input
                  value={row.key}
                  onChange={(event) =>
                    setDimensions((rows) => rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)))
                  }
                  aria-label={`Dimensions-Key ${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={row.label}
                  onChange={(event) =>
                    setDimensions((rows) => rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                  }
                  aria-label={`Dimensions-Name ${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sortierung</Label>
                <Select
                  value={row.order}
                  onValueChange={(value) =>
                    setDimensions((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, order: value as FacetOrder } : r)),
                    )
                  }
                >
                  <SelectTrigger aria-label={`Dimensions-Sortierung ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORDER_LABELS) as FacetOrder[]).map((order) => (
                      <SelectItem key={order} value={order}>
                        {ORDER_LABELS[order]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Einheit</Label>
                <Input
                  value={row.unit}
                  onChange={(event) =>
                    setDimensions((rows) => rows.map((r, i) => (i === index ? { ...r, unit: event.target.value } : r)))
                  }
                  aria-label={`Dimensions-Einheit ${index + 1}`}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.facet}
                  onChange={(event) =>
                    setDimensions((rows) => rows.map((r, i) => (i === index ? { ...r, facet: event.target.checked } : r)))
                  }
                  className="size-4 accent-primary"
                />
                Filter
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="pb-2"
                aria-label={`Dimension ${row.key || index + 1} entfernen`}
                onClick={() => setDimensions((rows) => rows.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDimensions((rows) => [...rows, { key: "", label: "", facet: true, order: "alpha", unit: "" }])
            }
          >
            <Plus className="size-4" aria-hidden /> Dimension hinzufügen
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Speichern
      </Button>
    </form>
  );
}
