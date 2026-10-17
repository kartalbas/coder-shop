// German PO copy + the status union (issue #35): labels belong in the pure lib next to
// the order labels, not in a component; the model re-exports the union (issue #31:
// one source per concept).
export type PurchaseOrderStatus = "draft" | "ordered" | "received";

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Entwurf",
  ordered: "Bestellt",
  received: "Erhalten",
};
