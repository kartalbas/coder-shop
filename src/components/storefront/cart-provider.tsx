"use client";

import { useEffect, type ReactNode } from "react";
import { hydrateCart } from "@/stores/cart";

export function CartProvider({ children }: { children: ReactNode }) {
  useEffect(() => hydrateCart(), []);
  return children;
}
