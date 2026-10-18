"use client";

import { Button } from "@/components/ui/button";
import { useLabels } from "@/components/labels";
import { interpolate, label } from "@/lib/i18n";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: Props) {
  const labels = useLabels();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );

  return (
    <nav aria-label={label(labels, "shop.pagination.label")} className="mt-8 flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">
        {interpolate(label(labels, "shop.pagination.showing"), { from, to, total })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          {label(labels, "shop.pagination.previous")}
        </Button>
        {numbers.map((n, index) => (
          <span key={n} className="flex items-center gap-1">
            {index > 0 && numbers[index - 1] !== n - 1 && <span className="px-1">…</span>}
            <Button
              variant={n === page ? "default" : "outline"}
              size="sm"
              className="w-9"
              aria-current={n === page ? "page" : undefined}
              onClick={() => onChange(n)}
            >
              {n}
            </Button>
          </span>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          {label(labels, "shop.pagination.next")}
        </Button>
      </div>
    </nav>
  );
}
