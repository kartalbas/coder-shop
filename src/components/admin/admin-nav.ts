import {
  Boxes,
  Languages,
  LayoutDashboard,
  Layers,
  Mail,
  PackageOpen,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Truck,
  UserRound,
  Users,
} from "lucide-react";

// Issue #58 admin slice: the labels are translation-table keys resolved per request
// language — the nav set itself stays data, a new entry needs a row and a line here.
export const ADMIN_NAV = [
  { href: "/admin", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
  { href: "/admin/products", labelKey: "admin.nav.products", icon: Boxes },
  { href: "/admin/orders", labelKey: "admin.nav.orders", icon: ShoppingCart },
  { href: "/admin/customers", labelKey: "admin.nav.customers", icon: UserRound },
  { href: "/admin/reviews", labelKey: "admin.nav.reviews", icon: Star },
  { href: "/admin/discounts", labelKey: "admin.nav.discounts", icon: Tag },
  { href: "/admin/invoices", labelKey: "admin.nav.invoices", icon: ReceiptText },
  { href: "/admin/packing", labelKey: "admin.nav.packing", icon: PackageOpen },
  { href: "/admin/pickup", labelKey: "admin.nav.pickup", icon: Store },
  { href: "/admin/purchasing", labelKey: "admin.nav.purchasing", icon: Truck },
  { href: "/admin/stock-units", labelKey: "admin.nav.stockUnits", icon: ScanBarcode },
  { href: "/admin/suppliers", labelKey: "admin.nav.suppliers", icon: Users },
  { href: "/admin/mails", labelKey: "admin.nav.mails", icon: Mail },
  { href: "/admin/catalog-types", labelKey: "admin.nav.catalogTypes", icon: Layers },
  { href: "/admin/translations", labelKey: "admin.nav.translations", icon: Languages },
  { href: "/admin/settings", labelKey: "admin.nav.settings", icon: Settings },
] as const;
