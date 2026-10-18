import type { Formatters } from "@/lib/format";
import { interpolate, label } from "@/lib/i18n";
import { PACKAGING_GRAMS, parcelWeightGrams } from "@/lib/shipping/weight";
import type { Order } from "@/models/order";

// Issue #58 step 2: the slip answers in the admin's request language — the page hands
// over its label map, the packaging weight interpolates PACKAGING_GRAMS.
// #58 admin formats slice: the weights follow the same language row via the page's
// formatters (server→server prop, like the label map).
export function PackList({
  order,
  labels,
  formatters,
}: {
  order: Order;
  labels: Record<string, string>;
  formatters: Formatters;
}) {
  const lines = [...order.lines].sort((a, b) => a.sku.localeCompare(b.sku));
  const weight = parcelWeightGrams(order.lines);

  return (
    <div className="print-slip rounded-xl border bg-card p-6 text-card-foreground">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">{label(labels, "admin.packing.slip.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {interpolate(label(labels, "admin.orders.heading"), { number: order.orderNumber })}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{order.customer.name}</p>
          <p className="text-muted-foreground">
            {order.customer.street} · {order.customer.postalCode} {order.customer.city} ·{" "}
            {order.customer.country}
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
            <th className="py-2 pr-4 font-medium">SKU</th>
            <th className="py-2 pr-4 font-medium">{label(labels, "admin.packing.slip.article")}</th>
            <th className="py-2 pr-4 font-medium">{label(labels, "admin.packing.slip.variant")}</th>
            <th className="py-2 pr-4 text-right font-medium">{label(labels, "admin.packing.slip.quantity")}</th>
            <th className="py-2 text-right font-medium">{label(labels, "admin.packing.slip.weight")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.sku} className="border-b last:border-0">
              <td className="py-2 pr-4 font-mono text-xs">
                {line.sku}
                {/* Issue #62 (#54): the exact units travel with the parcel. */}
                {line.serials && line.serials.length > 0 && (
                  <span className="block font-normal text-muted-foreground">
                    {line.serials.join(", ")}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4">{line.name}</td>
              <td className="py-2 pr-4 text-muted-foreground">{line.variantLabel}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{line.qty}</td>
              <td className="py-2 text-right tabular-nums">{formatters.weight(line.weightGrams)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="py-3 text-sm font-medium">
              {interpolate(label(labels, "admin.packing.slip.totalWeight"), {
                weight: formatters.weight(PACKAGING_GRAMS),
              })}
            </td>
            <td colSpan={2} className="py-3 text-right font-semibold tabular-nums">
              {formatters.weight(weight)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
