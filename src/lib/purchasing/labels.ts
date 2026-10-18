// The status union (issue #35: one source per concept, the model re-exports it).
// Issue #58 step 4: the German copy left for the translation table — the badge renders
// `admin.po.status.<status>` rows in the request language.
export type PurchaseOrderStatus = "draft" | "ordered" | "received";
