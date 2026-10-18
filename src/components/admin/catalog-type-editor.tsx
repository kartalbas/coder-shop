"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
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
import { interpolate, label } from "@/lib/i18n";
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

const FACET_ORDERS: readonly FacetOrder[] = ["alpha", "numeric", "clothing-size"];

// Issue #64: the admin editor for the #61 catalog type configuration — types, labels,
// positions, dimensions, stock tracking, comparison flag, photo noun and brands.
export function CatalogTypeEditor({ config }: { config: CatalogTypeConfig }) {
  const labels = useLabels();
  // The toast fires from the action-state effect; the label is read through a ref kept
  // current by an effect so a label sync can never re-fire the toast (address-book).
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
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
      toast.success(label(labelsRef.current, "admin.catalogTypes.saved"));
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
            <Label htmlFor="typeKey">{label(labels, "admin.catalogTypes.field.key")}</Label>
            <Input id="typeKey" value={form.key} onChange={(event) => set("key", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typeLabel">{label(labels, "admin.field.name")}</Label>
            <Input id="typeLabel" value={form.label} onChange={(event) => set("label", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typePosition">{label(labels, "admin.catalogTypes.column.position")}</Label>
            <Input
              id="typePosition"
              value={form.position}
              onChange={(event) => set("position", event.target.value)}
              inputMode="numeric"
              className="max-w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typeStock">{label(labels, "admin.catalogTypes.field.stockTracking")}</Label>
            <Select
              value={form.stockTracking}
              onValueChange={(value) => set("stockTracking", value as StockTracking)}
            >
              <SelectTrigger id="typeStock">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quantity">
                  {label(labels, "admin.catalogTypes.stockTracking.quantity")}
                </SelectItem>
                <SelectItem value="serial">
                  {label(labels, "admin.catalogTypes.stockTracking.serial")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typePhotoNoun">{label(labels, "admin.catalogTypes.field.photoNoun")}</Label>
            <Input
              id="typePhotoNoun"
              value={form.photoNoun}
              onChange={(event) => set("photoNoun", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typeBrands">{label(labels, "admin.catalogTypes.field.brands")}</Label>
            <Input id="typeBrands" value={form.brands} onChange={(event) => set("brands", event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.comparable}
              onChange={(event) => set("comparable", event.target.checked)}
              className="size-4 accent-primary"
            />
            {label(labels, "admin.catalogTypes.comparable")}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">{label(labels, "admin.catalogTypes.dimensionsTitle")}</h2>
          {dimensions.map((row, index) => (
            <div key={index} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_180px_110px_auto_auto]">
              <div className="space-y-1">
                <Label className="text-xs">{label(labels, "admin.field.key")}</Label>
                <Input
                  value={row.key}
                  onChange={(event) =>
                    setDimensions((rows) => rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)))
                  }
                  aria-label={interpolate(label(labels, "admin.catalogTypes.dimensionKeyAria"), { index: index + 1 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{label(labels, "admin.field.name")}</Label>
                <Input
                  value={row.label}
                  onChange={(event) =>
                    setDimensions((rows) => rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                  }
                  aria-label={interpolate(label(labels, "admin.catalogTypes.dimensionNameAria"), { index: index + 1 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{label(labels, "admin.catalogTypes.column.order")}</Label>
                <Select
                  value={row.order}
                  onValueChange={(value) =>
                    setDimensions((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, order: value as FacetOrder } : r)),
                    )
                  }
                >
                  <SelectTrigger aria-label={interpolate(label(labels, "admin.catalogTypes.dimensionOrderAria"), { index: index + 1 })}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACET_ORDERS.map((order) => (
                      <SelectItem key={order} value={order}>
                        {label(labels, `admin.catalogTypes.order.${order}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{label(labels, "admin.catalogTypes.column.unit")}</Label>
                <Input
                  value={row.unit}
                  onChange={(event) =>
                    setDimensions((rows) => rows.map((r, i) => (i === index ? { ...r, unit: event.target.value } : r)))
                  }
                  aria-label={interpolate(label(labels, "admin.catalogTypes.dimensionUnitAria"), { index: index + 1 })}
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
                {label(labels, "admin.catalogTypes.column.facet")}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="pb-2"
                aria-label={interpolate(label(labels, "admin.catalogTypes.dimensionRemoveAria"), {
                  name: row.key || index + 1,
                })}
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
            <Plus className="size-4" aria-hidden /> {label(labels, "admin.catalogTypes.addDimension")}
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "admin.action.save")}
      </Button>
    </form>
  );
}
