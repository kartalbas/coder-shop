import type { OrderStatus } from "./state-machine";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Neu",
  paid: "Bezahlt",
  picking: "In Kommission",
  packed: "Verpackt",
  shipped: "Versandt",
  delivered: "Zugestellt",
  cancelled: "Storniert",
};
