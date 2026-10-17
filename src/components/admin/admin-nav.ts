import {
  Boxes,
  LayoutDashboard,
  Mail,
  PackageOpen,
  ReceiptText,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produkte", icon: Boxes },
  { href: "/admin/orders", label: "Bestellungen", icon: ShoppingCart },
  { href: "/admin/invoices", label: "Rechnungen", icon: ReceiptText },
  { href: "/admin/packing", label: "Kommissionierung", icon: PackageOpen },
  { href: "/admin/pickup", label: "Abholung", icon: Store },
  { href: "/admin/purchasing", label: "Einkauf", icon: Truck },
  { href: "/admin/suppliers", label: "Lieferanten", icon: Users },
  { href: "/admin/mails", label: "Mails", icon: Mail },
] as const;
