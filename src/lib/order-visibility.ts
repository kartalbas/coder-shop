// Issue #39: who may see the full details (PII) of an order. Pure rule so it is testable
// without Next.js context; the page supplies the already-resolved facts.
export interface OrderVisibilityInput {
  /** Browser holds the per-order access cookie granted at checkout / e-mail verification. */
  hasAccessCookie: boolean;
  /** Signed-in admin. */
  isAdmin: boolean;
  /** Signed-in customer's user id, if any. */
  customerId: string | null;
  /** Signed-in customer's e-mail (already lower-case), if any. */
  customerEmail: string | null;
  /** Order fields. */
  orderUserId: string | null;
  orderEmail: string;
}

export function canViewOrderDetails(input: OrderVisibilityInput): boolean {
  if (input.hasAccessCookie || input.isAdmin) return true;
  if (!input.customerId) return false;
  if (input.orderUserId) return input.orderUserId === input.customerId;
  // Unlinked (guest) orders become visible to the account with the same e-mail.
  return (
    input.customerEmail !== null &&
    input.customerEmail === input.orderEmail.trim().toLowerCase()
  );
}
