import { formatWeight } from "@/lib/format";
import { parcelWeightGrams } from "@/lib/shipping/weight";
import type { Order } from "@/models/order";

export function PackList({ order }: { order: Order }) {
  const lines = [...order.lines].sort((a, b) => a.sku.localeCompare(b.sku));
  const weight = parcelWeightGrams(order.lines);

  return (
    <div className="print-slip rounded-xl border bg-card p-6 text-card-foreground">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Lieferschein / Packliste</h2>
          <p className="text-sm text-muted-foreground">Bestellung {order.orderNumber}</p>
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
            <th className="py-2 pr-4 font-medium">Artikel</th>
            <th className="py-2 pr-4 font-medium">Variante</th>
            <th className="py-2 pr-4 text-right font-medium">Menge</th>
            <th className="py-2 text-right font-medium">Gewicht</th>
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
              <td className="py-2 text-right tabular-nums">{formatWeight(line.weightGrams)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="py-3 text-sm font-medium">
              Paketgewicht (inkl. {"150 g"} Verpackung)
            </td>
            <td colSpan={2} className="py-3 text-right font-semibold tabular-nums">
              {formatWeight(weight)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
