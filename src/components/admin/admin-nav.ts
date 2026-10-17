import {
  Boxes,
  LayoutDashboard,
  PackageOpen,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produkte", icon: Boxes },
  { href: "/admin/orders", label: "Bestellungen", icon: ShoppingCart },
  { href: "/admin/packing", label: "Kommissionierung", icon: PackageOpen },
  { href: "/admin/purchasing", label: "Einkauf", icon: Truck },
  { href: "/admin/suppliers", label: "Lieferanten", icon: Users },
] as const;
