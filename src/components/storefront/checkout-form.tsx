"use client";

import { useEffect, useMemo, useRef, useState, useActionState } from "react";
import type { ZodError } from "zod";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatChf } from "@/lib/format";
import { computeTotals, shippingCents, VAT_INCLUSIVE_NOTE } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  checkoutSchema,
  type CheckoutCustomer,
  type ShippingMethodParam,
} from "@/lib/validations/checkout";
import { createOrderAction, type CheckoutActionState } from "@/server/actions/checkout";
import Link from "next/link";
import { cartSubtotalCents, clearCart, syncPrices, useCart, useCartHydrated } from "@/stores/cart";

const CUSTOMER_FIELDS: {
  key: keyof CheckoutCustomer;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  inputMode?: "numeric" | "tel" | "text";
  className?: string;
}[] = [
  { key: "name", label: "Name, Vorname", type: "text", autoComplete: "name", placeholder: "Max Muster", className: "sm:col-span-2" },
  { key: "email", label: "E-Mail", type: "email", autoComplete: "email", placeholder: "max@example.ch", className: "sm:col-span-2" },
  { key: "phone", label: "Telefon", type: "tel", autoComplete: "tel", placeholder: "079 123 45 67" },
  { key: "street", label: "Strasse, Hausnummer", type: "text", autoComplete: "street-address", placeholder: "Bahnhofstrasse 12" },
  { key: "postalCode", label: "PLZ", type: "text", inputMode: "numeric", autoComplete: "postal-code", placeholder: "8001" },
  { key: "city", label: "Ort", type: "text", autoComplete: "address-level2", placeholder: "Zürich" },
];

const SHIPPING_OPTIONS: { value: ShippingMethodParam; title: string; hint: string }[] = [
  { value: "standard", title: "Standard", hint: "2–4 Werktage" },
  { value: "express", title: "Express", hint: "nächster Werktag" },
];

type FieldErrors = Partial<Record<string, string>>;

function fieldErrorsFrom(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] === "customer" ? issue.path[1] : issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function CheckoutForm() {
  const router = useRouter();
  const cart = useCart();
  const hydrated = useCartHydrated();
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodParam>("standard");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, formAction, pending] = useActionState<CheckoutActionState | null, FormData>(
    createOrderAction,
    null,
  );
  const redirected = useRef(false);

  const subtotal = cartSubtotalCents(cart);
  const totals = useMemo(
    () =>
      computeTotals(
        cart.lines.map((line) => ({ unitPriceCents: line.unitPriceCents, qty: line.qty })),
        shippingMethod,
      ),
    [cart.lines, shippingMethod],
  );

  useEffect(() => {
    if (state?.ok && state.orderNumber && !redirected.current) {
      redirected.current = true;
      clearCart();
      toast.success("Bestellung aufgegeben", { description: `Bestellung ${state.orderNumber}` });
      router.push(`/bestellung/${state.orderNumber}`);
    }
  }, [state, router]);

  useEffect(() => {
    if (state && !state.ok && state.error) {
      if (state.reason === "price_changed" && state.changed) {
        // Show the current prices immediately; the customer confirms the new total (issue #12).
        syncPrices(state.changed);
        toast.warning(state.error);
      } else {
        toast.error(state.error);
      }
    }
  }, [state]);

  // Issue #27: no empty-cart flash — the page keeps its single <h1>, the form area
  // stays a skeleton until the persisted cart is loaded.
  if (!hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]" aria-busy="true">
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <p className="text-2xl font-bold">Es gibt nichts zu bezahlen</p>
        <p className="text-muted-foreground">Ihr Warenkorb ist leer.</p>
        <Button asChild size="lg" variant="outline">
          <Link href="/produkte">Weiter einkaufen</Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = (formData: FormData) => {
    const customer = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      street: String(formData.get("street") ?? ""),
      postalCode: String(formData.get("postalCode") ?? ""),
      city: String(formData.get("city") ?? ""),
      country: "CH",
    };
    const payload = {
      lines: cart.lines.map((line) => ({
        sku: line.sku,
        qty: line.qty,
        expectedUnitPriceCents: line.unitPriceCents,
      })),
      customer,
      shippingMethod,
    };
    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    formData.set("payload", JSON.stringify(payload));
    return formAction(formData);
  };

  return (
    <form action={handleSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <fieldset id="adresse" className="scroll-mt-24">
          <legend className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
            Adresse
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {CUSTOMER_FIELDS.map((field) => (
              <div key={field.key} className={cn("space-y-1.5", field.className)}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  name={field.key}
                  type={field.type}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  aria-invalid={errors[field.key] !== undefined}
                  aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}
                />
                {errors[field.key] && (
                  <p id={`${field.key}-error`} className="text-xs text-destructive">
                    {errors[field.key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset id="versand" className="scroll-mt-24">
          <legend className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
            Versand
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHIPPING_OPTIONS.map((option) => {
              const price = shippingCents(subtotal, option.value);
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-ring",
                    shippingMethod === option.value && "border-primary bg-primary/5",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={option.value}
                      checked={shippingMethod === option.value}
                      onChange={() => setShippingMethod(option.value)}
                      className="size-4 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">{option.title}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </span>
                  <span className="text-sm font-semibold">
                    {price === 0 ? "Gratis" : formatChf(price)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset id="zahlung" className="scroll-mt-24">
          <legend className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
            Zahlung
          </legend>
          <Card>
            <CardContent className="space-y-4 p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-4" aria-hidden />
                Demo-Zahlung — es wird keine echte Karte belastet.
              </p>
              {/* Issue #27: deliberately no name attributes — the mock card data is a
                  UI stub and must never be part of the submitted form data. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cardName">Karteninhaber</Label>
                  <Input id="cardName" placeholder="Max Muster" autoComplete="cc-name" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cardNumber">Kartennummer</Label>
                  <Input
                    id="cardNumber"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="4242 4242 4242 4242"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cardExpiry">Gültig bis</Label>
                  <Input id="cardExpiry" autoComplete="cc-exp" placeholder="12/28" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cardCvc">CVC</Label>
                  <Input
                    id="cardCvc"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    maxLength={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </fieldset>
      </div>

      <aside>
        <Card className="lg:sticky lg:top-24">
          <CardContent className="space-y-4 p-5">
            <h2 className="font-semibold">Bestellübersicht</h2>
            <ul className="space-y-2 text-sm">
              {cart.lines.map((line) => (
                <li key={line.sku} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {line.qty}× {line.name} <span className="text-xs">({line.variantLabel})</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatChf(line.unitPriceCents * line.qty)}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Zwischensumme</dt>
                <dd className="tabular-nums">{formatChf(totals.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Versand</dt>
                <dd className="tabular-nums">
                  {totals.shippingCents === 0 ? "Gratis" : formatChf(totals.shippingCents)}
                </dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Gesamt</dt>
                <dd className="tabular-nums">{formatChf(totals.totalCents)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">{VAT_INCLUSIVE_NOTE}</p>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Jetzt kaufen — {formatChf(totals.totalCents)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Mit der Bestellung akzeptieren Sie unsere AGB (Demo).
            </p>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
