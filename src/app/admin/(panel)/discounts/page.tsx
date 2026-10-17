export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { DiscountCreateForm, DiscountToggle } from "@/components/admin/discount-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatChf, formatDate } from "@/lib/format";
import { listDiscountsCore } from "@/server/discounts";

export const metadata: Metadata = {
  title: "Aktionen — Admin",
  description: "Gutscheincodes anlegen und verwalten, mit Nutzungsstatistik.",
};

// Discount code management (issue #45): every code with its limits, window and how
// often it was used — by orders and by distinct customers.
async function DiscountsView() {
  await connection();
  const discounts = await listDiscountsCore();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Aktionen</h1>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-semibold">Neuen Code anlegen</h2>
          <DiscountCreateForm />
        </CardContent>
      </Card>

      {discounts.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Noch keine Codes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Rabatt</th>
                <th className="px-3 py-2 font-medium">Gültig</th>
                <th className="px-3 py-2 text-right font-medium">Genutzt</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-mono font-medium">{discount.code}</span>
                    {discount.perCustomerOnce && (
                      <span className="ml-2 text-xs text-muted-foreground">1×/Kunde</span>
                    )}
                    {discount.minOrderCents > 0 && (
                      <p className="text-xs text-muted-foreground">
                        ab {formatChf(discount.minOrderCents)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {discount.kind === "percent"
                      ? `${discount.percent} %`
                      : formatChf(discount.amountCents ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {discount.validFrom || discount.validTo
                      ? `${discount.validFrom ? formatDate(discount.validFrom) : "ab"} – ${discount.validTo ? formatDate(discount.validTo) : "offen"}`
                      : "unbefristet"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {discount.usedCount}
                    {discount.usageLimit !== undefined && ` / ${discount.usageLimit}`}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({discount.customerCount} Kunden)
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {discount.active ? (
                      <Badge variant="outline" className="border-emerald-700 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400">
                        Aktiv
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inaktiv
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DiscountToggle discountId={discount.id} active={discount.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminDiscountsPage() {
  return <DiscountsView />;
}
