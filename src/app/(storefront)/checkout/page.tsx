import type { Metadata } from "next";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { VAT_LABEL } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Kasse",
  description: `Adresse, Versand und Zahlung — coder-shop. Preise in CHF inklusive ${VAT_LABEL}.`,
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Kasse</h1>
      <CheckoutForm />
    </div>
  );
}
