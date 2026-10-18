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
import { useFormatters } from "@/components/locale-formatters";
import { INVOICE_DUE_DAYS } from "@/lib/invoices";
import { interpolate, label, splitOnPlaceholder } from "@/lib/i18n";
import { computeTotals, shippingCents, subtotalCents } from "@/lib/pricing";
import {
  activeShippingMethods,
  paymentMethodsForShipping,
  vatLabel,
  type PaymentMethodConfig,
  type ShippingMethodConfig,
} from "@/lib/shop-settings";
import { useShopSettings } from "@/components/shop-settings-provider";
import { STORE } from "@/lib/store";
import { cn } from "@/lib/utils";
import { createCheckoutSchema, type CheckoutCustomer } from "@/lib/validations/checkout";
import { createOrderAction, type CheckoutActionState } from "@/server/actions/checkout";
import { validateDiscountAction } from "@/server/actions/discounts";
import { DiscountInput } from "@/components/storefront/discount-input";
import Link from "next/link";
import { cartSubtotalCents, clearCart, syncPrices, useCart, useCartHydrated } from "@/stores/cart";

// Issue #58 step 3: the labels are translation-table keys resolved at render; the
// placeholders stay — they are sample values, not UI copy. The city sample is the one
// exception: place names are spelled per language, so it is a row.
const CUSTOMER_FIELDS: {
  key: keyof CheckoutCustomer;
  labelKey: string;
  type: string;
  autoComplete: string;
  placeholder?: string;
  placeholderKey?: string;
  inputMode?: "numeric" | "tel" | "text";
  className?: string;
}[] = [
  { key: "name", labelKey: "shop.checkout.field.name", type: "text", autoComplete: "name", placeholder: "Max Muster", className: "sm:col-span-2" },
  { key: "email", labelKey: "shop.checkout.field.email", type: "email", autoComplete: "email", placeholder: "max@example.ch", className: "sm:col-span-2" },
  { key: "phone", labelKey: "shop.checkout.field.phone", type: "tel", autoComplete: "tel", placeholder: "079 123 45 67" },
  { key: "street", labelKey: "shop.checkout.field.street", type: "text", autoComplete: "street-address", placeholder: "Bahnhofstrasse 12" },
  { key: "postalCode", labelKey: "shop.checkout.field.postalCode", type: "text", inputMode: "numeric", autoComplete: "postal-code", placeholder: "8001" },
  { key: "city", labelKey: "shop.checkout.field.city", type: "text", autoComplete: "address-level2", placeholderKey: "shop.checkout.sample.city" },
];

// Issue #64: the shipping hint of a store-pickup row names the store; every other
// method shows its configured hint.
function shippingHint(method: ShippingMethodConfig): string {
  return method.storePickup ? `${STORE.city} · ${STORE.hours[0]}` : method.hint;
}

// The hint under a payment label follows the configured kind, not the key; the text
// itself is a translation-table row (#58 step 3).
function paymentHint(method: PaymentMethodConfig, labels: Record<string, string>): string {
  if (method.kind === "invoice")
    return interpolate(label(labels, "shop.checkout.paymentHint.invoice"), {
      days: INVOICE_DUE_DAYS,
    });
  if (method.kind === "on_pickup") return label(labels, "shop.checkout.paymentHint.pickup");
  return label(labels, "shop.checkout.paymentHint.immediate");
}

// The invoice card sentence with the account link placed where the language's word
// order puts `{link}` (#58 step 3) — the {days} value comes from the invoice rule.
function InvoiceNote({ labels }: { labels: Record<string, string> }) {
  const { before, after } = splitOnPlaceholder(
    interpolate(label(labels, "shop.checkout.invoiceNote"), { days: INVOICE_DUE_DAYS }),
    "link",
  );
  return (
    <p>
      {before}
      <Link href="/account/invoices" className="underline underline-offset-2">
        {label(labels, "shop.checkout.invoiceLink")}
      </Link>
      {after}
    </p>
  );
}

type FieldErrors = Partial<Record<string, string>>;

function fieldErrorsFrom(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] === "customer" ? issue.path[1] : issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// Issue #39: logged-in customers start from their profile / default address.
export interface CheckoutPrefill {
  name: string;
  email: string;
  street: string;
  postalCode: string;
  city: string;
}

// Issue #40: „Rechnung“ is offered only to logged-in customers whose credit still has
// room — the server decides and re-checks; the form just renders the choice.
export function CheckoutForm({
  prefill,
  invoiceAvailable = false,
  labels,
}: {
  prefill?: CheckoutPrefill;
  invoiceAvailable?: boolean;
  // Issue #58 step 3: translation-table labels for the whole checkout flow.
  labels: Record<string, string>;
}) {
  const { chf } = useFormatters();
  const router = useRouter();
  const cart = useCart();
  const hydrated = useCartHydrated();
  // Issue #64: shipping and payment choices are configuration rows. The selected keys
  // fall back to the first available option, so a method disabled between renders can
  // never be submitted.
  const settings = useShopSettings();
  const shippingOptions = useMemo(() => activeShippingMethods(settings), [settings]);
  const [shippingKey, setShippingKey] = useState("");
  const [paymentKey, setPaymentKey] = useState("");
  const shipping = shippingOptions.find((method) => method.key === shippingKey) ?? shippingOptions[0];
  const paymentOptions = useMemo(
    () =>
      shipping
        ? paymentMethodsForShipping(settings, shipping).filter(
            (method) => invoiceAvailable || method.kind !== "invoice",
          )
        : [],
    [settings, shipping, invoiceAvailable],
  );
  const payment = paymentOptions.find((method) => method.key === paymentKey) ?? paymentOptions[0];
  const [errors, setErrors] = useState<FieldErrors>({});
  // #58: client-side field errors use the same table rows as the server — the schema is
  // built from the request language's label map (text-only swap when LabelsSync lands).
  const validationSchema = useMemo(() => createCheckoutSchema(labels), [labels]);
  // Issue #45: the reduction of the applied code, for the summary display only — the
  // server recomputes it inside the transaction.
  const [discountCents, setDiscountCents] = useState(0);
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
        shipping?.key ?? "",
        settings,
        discountCents,
      ),
    [cart.lines, shipping, settings, discountCents],
  );

  // A code carried over from the cart is re-validated so the summary can show its
  // reduction; if it stopped working the server will refuse it at order time anyway.
  const revalidated = useRef(false);
  const carriedCode = cart.discountCode;
  const cartLines = cart.lines;
  useEffect(() => {
    if (!carriedCode || revalidated.current || cartLines.length === 0) return;
    revalidated.current = true;
    validateDiscountAction(carriedCode, subtotalCents(cartLines)).then((result) => {
      setDiscountCents(result.ok ? (result.discountCents ?? 0) : 0);
    });
  }, [carriedCode, cartLines]);

  useEffect(() => {
    if (state?.ok && state.orderNumber && !redirected.current) {
      redirected.current = true;
      clearCart();
      toast.success(label(labels, "shop.checkout.successTitle"), {
        description: interpolate(label(labels, "shop.checkout.successDescription"), {
          number: state.orderNumber,
        }),
      });
      router.push(`/orders/${state.orderNumber}`);
    }
  }, [state, router, labels]);

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
        <p className="text-2xl font-bold">{label(labels, "shop.checkout.emptyTitle")}</p>
        <p className="text-muted-foreground">{label(labels, "shop.cart.emptyDrawer")}</p>
        <Button asChild size="lg" variant="outline">
          <Link href="/products">{label(labels, "shop.action.continueShopping")}</Link>
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
      shippingMethod: shipping?.key ?? "",
      paymentMethod: payment?.key ?? "",
      ...(cart.discountCode !== undefined && { discountCode: cart.discountCode }),
    };
    const parsed = validationSchema.safeParse(payload);
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
        <fieldset id="address" className="scroll-mt-24">
          <legend className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
            {label(labels, "shop.checkout.legend.address")}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {CUSTOMER_FIELDS.map((field) => (
              <div key={field.key} className={cn("space-y-1.5", field.className)}>
                <Label htmlFor={field.key}>{label(labels, field.labelKey)}</Label>
                <Input
                  id={field.key}
                  name={field.key}
                  type={field.type}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  placeholder={
                    field.placeholderKey ? label(labels, field.placeholderKey) : field.placeholder
                  }
                  defaultValue={prefill?.[field.key as keyof CheckoutPrefill] ?? ""}
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

        <fieldset id="shipping" className="scroll-mt-24">
          <legend className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
            {label(labels, "shop.checkout.legend.shipping")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {shippingOptions.map((option) => {
              const price = shippingCents(subtotal, option.key, settings);
              return (
                <label
                  key={option.key}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-ring",
                    shipping?.key === option.key && "border-primary bg-primary/5",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={option.key}
                      checked={shipping?.key === option.key}
                      onChange={() => setShippingKey(option.key)}
                      className="size-4 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {shippingHint(option)}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm font-semibold">
                    {price === 0 ? label(labels, "shop.checkout.free") : chf(price)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset id="payment" className="scroll-mt-24">
          <legend className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
            {label(labels, "shop.checkout.legend.payment")}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {paymentOptions.map((method) => (
              <label
                key={method.key}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-ring",
                  payment?.key === method.key && "border-primary bg-primary/5",
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.key}
                    checked={payment?.key === method.key}
                    onChange={() => setPaymentKey(method.key)}
                    className="size-4 accent-primary"
                  />
                  <span>
                    <span className="block font-medium">{method.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {paymentHint(method, labels)}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          {payment?.kind === "invoice" ? (
            <Card className="mt-3">
              <CardContent className="space-y-1 p-5 text-sm text-muted-foreground">
                <InvoiceNote labels={labels} />
              </CardContent>
            </Card>
          ) : payment?.kind === "on_pickup" ? (
            <Card className="mt-3">
              <CardContent className="space-y-1 p-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {STORE.name} · {STORE.street}, {STORE.postalCode} {STORE.city}
                </p>
                {STORE.hours.map((hour) => (
                  <p key={hour}>{hour}</p>
                ))}
                <p className="pt-1">{label(labels, "shop.checkout.pickupNote")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-3">
              <CardContent className="space-y-4 p-5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="size-4" aria-hidden />
                  {label(labels, "shop.checkout.demoNotice")}
                </p>
                {/* Issue #27: deliberately no name attributes — the mock card data is a
                    UI stub and must never be part of the submitted form data. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cardName">{label(labels, "shop.checkout.card.name")}</Label>
                    <Input id="cardName" placeholder="Max Muster" autoComplete="cc-name" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cardNumber">{label(labels, "shop.checkout.card.number")}</Label>
                    <Input
                      id="cardNumber"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="4242 4242 4242 4242"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cardExpiry">{label(labels, "shop.checkout.card.expiry")}</Label>
                    <Input id="cardExpiry" autoComplete="cc-exp" placeholder="12/28" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cardCvc">{label(labels, "shop.checkout.card.cvc")}</Label>
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
          )}
        </fieldset>
      </div>

      <aside>
        <Card className="lg:sticky lg:top-24">
          <CardContent className="space-y-4 p-5">
            <h2 className="font-semibold">{label(labels, "shop.checkout.summaryTitle")}</h2>
            <ul className="space-y-2 text-sm">
              {cart.lines.map((line) => (
                <li key={line.sku} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {line.qty}× {line.name} <span className="text-xs">({line.variantLabel})</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{chf(line.unitPriceCents * line.qty)}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <DiscountInput
              subtotalCents={totals.subtotalCents}
              labels={labels}
              onDiscountChange={setDiscountCents}
            />
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{label(labels, "shop.cart.subtotal")}</dt>
                <dd className="tabular-nums">{chf(totals.subtotalCents)}</dd>
              </div>
              {totals.discountCents > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>
                    {label(labels, "shop.checkout.discount")}
                    {cart.discountCode ? ` (${cart.discountCode})` : ""}
                  </dt>
                  <dd className="tabular-nums">−{chf(totals.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{label(labels, "shop.checkout.summary.shipping")}</dt>
                <dd className="tabular-nums">
                  {totals.shippingCents === 0 ? label(labels, "shop.checkout.free") : chf(totals.shippingCents)}
                </dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>{label(labels, "shop.checkout.total")}</dt>
                <dd className="tabular-nums">{chf(totals.totalCents)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              {interpolate(label(labels, "shop.checkout.vatNote"), {
                vat: vatLabel(settings.vatRatePercent),
              })}
            </p>
            <Button type="submit" size="lg" className="w-full" disabled={pending || !shipping || !payment}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {label(
                labels,
                payment?.kind === "invoice" ? "shop.checkout.submitInvoice" : "shop.checkout.submit",
              )}{" "}
              — {chf(totals.totalCents)}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {label(labels, "shop.checkout.agb")}
            </p>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
