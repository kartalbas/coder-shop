export const instant = false;

import type { Metadata } from "next";
import { connection } from "next/server";
import { DiscountCreateForm, DiscountToggle } from "@/components/admin/discount-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { interpolate, label } from "@/lib/i18n";
import { getRequestFormatters, getRequestLabels } from "@/server/i18n";
import { listDiscountsCore } from "@/server/discounts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const labels = await getRequestLabels();
  return {
    title: label(labels, "admin.meta.discounts.title"),
    description: label(labels, "admin.meta.discounts.description"),
  };
}

// Discount code management (issue #45): every code with its limits, window and how
// often it was used — by orders and by distinct customers.
async function DiscountsView() {
  await connection();
  const [discounts, labels] = await Promise.all([listDiscountsCore(), getRequestLabels()]);
  const f = await getRequestFormatters();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{label(labels, "admin.discounts.title")}</h1>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 font-semibold">{label(labels, "admin.discounts.create.title")}</h2>
          <DiscountCreateForm />
        </CardContent>
      </Card>

      {discounts.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {label(labels, "admin.discounts.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{label(labels, "admin.discounts.column.code")}</th>
                <th className="px-3 py-2 font-medium">{label(labels, "admin.discounts.column.discount")}</th>
                <th className="px-3 py-2 font-medium">{label(labels, "admin.discounts.column.valid")}</th>
                <th className="px-3 py-2 text-right font-medium">{label(labels, "admin.discounts.column.used")}</th>
                <th className="px-3 py-2 font-medium">{label(labels, "admin.orders.column.status")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-mono font-medium">{discount.code}</span>
                    {discount.perCustomerOnce && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {label(labels, "admin.discounts.perCustomer")}
                      </span>
                    )}
                    {discount.minOrderCents > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {interpolate(label(labels, "admin.discounts.minOrder"), {
                          amount: f.chf(discount.minOrderCents),
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {discount.kind === "percent"
                      ? `${discount.percent} %`
                      : f.chf(discount.amountCents ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {discount.validFrom || discount.validTo
                      ? `${discount.validFrom ? f.date(discount.validFrom) : label(labels, "admin.discounts.valid.from")} – ${discount.validTo ? f.date(discount.validTo) : label(labels, "admin.discounts.valid.open")}`
                      : label(labels, "admin.discounts.valid.unlimited")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {discount.usedCount}
                    {discount.usageLimit !== undefined && ` / ${discount.usageLimit}`}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {interpolate(label(labels, "admin.discounts.customers"), {
                        count: discount.customerCount,
                      })}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {discount.active ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-700 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400"
                      >
                        {label(labels, "admin.discounts.status.active")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {label(labels, "admin.discounts.status.inactive")}
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
