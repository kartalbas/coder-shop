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
import { formatChf } from "@/lib/format";
import type { PaymentMethodKind, ShopSettings } from "@/lib/shop-settings";
import {
  saveShopSettingsAction,
  type ShopSettingsActionState,
} from "@/server/actions/admin/settings";

interface ShippingRow {
  key: string;
  label: string;
  priceChf: string;
  hint: string;
  storePickup: boolean;
  expressService: boolean;
  active: boolean;
}

interface PaymentRow {
  key: string;
  label: string;
  kind: PaymentMethodKind;
  active: boolean;
}

function chf(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const KIND_LABELS: Record<PaymentMethodKind, string> = {
  immediate: "Sofort (an der Kasse)",
  invoice: "Rechnung (offener Betrag)",
  on_pickup: "Bei Abholung (Schalter)",
};

// Issue #64: the commerce configuration editor — VAT rate, free-shipping threshold,
// shipping methods and payment methods. Row order is the checkout order.
export function ShopSettingsForm({ settings }: { settings: ShopSettings }) {
  const router = useRouter();
  const [vatRate, setVatRate] = useState(String(settings.vatRatePercent).replace(".", ","));
  const [freeFrom, setFreeFrom] = useState(chf(settings.freeShippingFromCents));
  const [shipping, setShipping] = useState<ShippingRow[]>(
    [...settings.shippingMethods]
      .sort((a, b) => a.position - b.position)
      .map((method) => ({
        key: method.key,
        label: method.label,
        priceChf: chf(method.priceCents),
        hint: method.hint,
        storePickup: method.storePickup,
        expressService: method.expressService,
        active: method.active,
      })),
  );
  const [payment, setPayment] = useState<PaymentRow[]>(
    [...settings.paymentMethods]
      .sort((a, b) => a.position - b.position)
      .map((method) => ({ key: method.key, label: method.label, kind: method.kind, active: method.active })),
  );
  const [state, formAction, pending] = useActionState<ShopSettingsActionState | null, FormData>(
    saveShopSettingsAction,
    null,
  );
  const announced = useRef(false);
  useEffect(() => {
    if (!state || announced.current) return;
    announced.current = true;
    if (state.ok) {
      toast.success("Konfiguration gespeichert");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    formData.set(
      "payload",
      JSON.stringify({
        vatRatePercent: Number(vatRate.replace(",", ".")),
        freeShippingFromCents: freeFrom,
        shippingMethods: shipping,
        paymentMethods: payment,
      }),
    );
    return formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vatRate">MwSt.-Satz (Prozent)</Label>
            <Input
              id="vatRate"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
              inputMode="decimal"
              className="max-w-32"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="freeFrom">Versandfrei ab (CHF)</Label>
            <Input
              id="freeFrom"
              value={freeFrom}
              onChange={(event) => setFreeFrom(event.target.value)}
              inputMode="decimal"
              className="max-w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">Versandarten</h2>
          {shipping.map((row, index) => (
            <div key={index} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_110px_1fr_auto_auto_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <Input
                  value={row.key}
                  onChange={(event) =>
                    setShipping((rows) => rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)))
                  }
                  aria-label={`Versand-Key ${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={row.label}
                  onChange={(event) =>
                    setShipping((rows) => rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                  }
                  aria-label={`Versand-Name ${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preis (CHF)</Label>
                <Input
                  value={row.priceChf}
                  onChange={(event) =>
                    setShipping((rows) => rows.map((r, i) => (i === index ? { ...r, priceChf: event.target.value } : r)))
                  }
                  inputMode="decimal"
                  aria-label={`Versand-Preis ${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hinweis</Label>
                <Input
                  value={row.hint}
                  onChange={(event) =>
                    setShipping((rows) => rows.map((r, i) => (i === index ? { ...r, hint: event.target.value } : r)))
                  }
                  aria-label={`Versand-Hinweis ${index + 1}`}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.storePickup}
                  onChange={(event) =>
                    setShipping((rows) => rows.map((r, i) => (i === index ? { ...r, storePickup: event.target.checked } : r)))
                  }
                  className="size-4 accent-primary"
                />
                Laden
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.expressService}
                  onChange={(event) =>
                    setShipping((rows) => rows.map((r, i) => (i === index ? { ...r, expressService: event.target.checked } : r)))
                  }
                  className="size-4 accent-primary"
                  aria-label={`Express-Versanddienst ${row.key || index + 1}`}
                  title="Express-Versanddienst"
                />
                Express
              </label>
              <div className="flex items-center gap-2 pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(event) =>
                      setShipping((rows) => rows.map((r, i) => (i === index ? { ...r, active: event.target.checked } : r)))
                    }
                    className="size-4 accent-primary"
                  />
                  Aktiv
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Versandart ${row.key || index + 1} entfernen`}
                  onClick={() => setShipping((rows) => rows.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setShipping((rows) => [
                ...rows,
                { key: "", label: "", priceChf: "0.00", hint: "", storePickup: false, expressService: false, active: true },
              ])
            }
          >
            <Plus className="size-4" aria-hidden /> Versandart hinzufügen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="font-semibold">Zahlungsarten</h2>
          {payment.map((row, index) => (
            <div key={index} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_220px_auto_auto]">
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <Input
                  value={row.key}
                  onChange={(event) =>
                    setPayment((rows) => rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)))
                  }
                  aria-label={`Zahlungs-Key ${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={row.label}
                  onChange={(event) =>
                    setPayment((rows) => rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                  }
                  aria-label={`Zahlungs-Name ${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Geldfluss</Label>
                <Select
                  value={row.kind}
                  onValueChange={(value) =>
                    setPayment((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, kind: value as PaymentMethodKind } : r)),
                    )
                  }
                >
                  <SelectTrigger aria-label={`Geldfluss ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABELS) as PaymentMethodKind[]).map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(event) =>
                    setPayment((rows) => rows.map((r, i) => (i === index ? { ...r, active: event.target.checked } : r)))
                  }
                  className="size-4 accent-primary"
                />
                Aktiv
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="pb-2"
                aria-label={`Zahlungsart ${row.key || index + 1} entfernen`}
                onClick={() => setPayment((rows) => rows.filter((_, i) => i !== index))}
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
              setPayment((rows) => [...rows, { key: "", label: "", kind: "immediate", active: true }])
            }
          >
            <Plus className="size-4" aria-hidden /> Zahlungsart hinzufügen
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Speichern
        </Button>
        <p className="text-sm text-muted-foreground">
          Aktuell: MwSt. {String(settings.vatRatePercent).replace(".", ",")} %, versandfrei ab{" "}
          {formatChf(settings.freeShippingFromCents)}.
        </p>
      </div>
    </form>
  );
}
