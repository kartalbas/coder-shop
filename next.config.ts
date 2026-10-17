import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      { source: "/produkte", destination: "/products" },
      { source: "/produkt/:slug", destination: "/products/:slug" },
      { source: "/warenkorb", destination: "/cart" },
      { source: "/kasse", destination: "/checkout" },
      { source: "/bestellung/:number", destination: "/order/:number" },
    ];
  },
};

export default nextConfig;
