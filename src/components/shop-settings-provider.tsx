"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from "@/lib/shop-settings";

// Issue #64: the shop settings are configuration; client components that compute
// totals or show rule read them from this context. The storefront layout stays a
// static shell (cacheComponents), so the provider loads the settings once from the
// public API and every consumer re-renders when they arrive — until then the seed
// defaults apply. Server-side consumers read `getShopSettings()` directly.
const ShopSettingsContext = createContext<ShopSettings>(DEFAULT_SHOP_SETTINGS);

export function ShopSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  useEffect(() => {
    let active = true;
    fetch("/api/shop-settings")
      .then((response) => (response.ok ? (response.json() as Promise<ShopSettings>) : null))
      .then((loaded) => {
        if (active && loaded) setSettings(loaded);
      })
      .catch(() => {
        // stay on the defaults — the server validates every write anyway
      });
    return () => {
      active = false;
    };
  }, []);
  return <ShopSettingsContext.Provider value={settings}>{children}</ShopSettingsContext.Provider>;
}

export function useShopSettings(): ShopSettings {
  return useContext(ShopSettingsContext);
}
