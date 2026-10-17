import type { ProductType } from "@/models/product";

const COLOR_HEX: Record<string, string> = {
  schwarz: "#1f2328",
  weiß: "#e8eaed",
  blau: "#2563eb",
  grün: "#16a34a",
  titan: "#8d8d94",
  grau: "#6b7280",
  anthrazit: "#374151",
  oliv: "#65751f",
  rot: "#dc2626",
  beige: "#d9c6a5",
};

export function colorHex(color: string): string {
  return COLOR_HEX[color] ?? "#64748b";
}

const PHONE_PATH =
  "M95 30 h70 a15 15 0 0 1 15 15 v130 a15 15 0 0 1 -15 15 h-70 a15 15 0 0 1 -15 -15 v-130 a15 15 0 0 1 15 -15 z";
const SHOE_PATH =
  "M40 150 q5 -45 30 -55 q10 -25 30 -25 q12 0 16 12 q30 18 70 25 q30 6 34 26 l2 17 q1 10 -10 10 h-166 q-8 0 -6 -10 z";
const SHIRT_PATH =
  "M85 55 l-45 25 l18 35 l22 -10 v105 h90 v-105 l22 10 l18 -35 l-45 -25 q-10 14 -40 14 q-30 0 -40 -14 z";

const TYPE_PATH: Record<ProductType, string> = {
  smartphone: PHONE_PATH,
  shoes: SHOE_PATH,
  clothing: SHIRT_PATH,
};

export interface SvgInput {
  name: string;
  type: ProductType;
  color: string;
}

export function productSvg(input: SvgInput, index: number): string {
  const fill = colorHex(input.color);
  const rotation = ((index - 1) * 17) % 360;
  const scale = 1 + ((index - 1) % 4) * 0.09;
  const hueShift = (index * 23) % 40 - 20;
  const bgTop = `hsl(${210 + hueShift}, 35%, ${88 - index * 4}%)`;
  const bgBottom = `hsl(${220 + hueShift}, 30%, ${70 - index * 3}%)`;
  const escaped = input.name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300" role="img" aria-label="${escaped}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bgTop}"/>
      <stop offset="1" stop-color="${bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#bg)"/>
  <ellipse cx="150" cy="235" rx="95" ry="14" fill="rgba(0,0,0,0.18)"/>
  <g transform="translate(150 140) rotate(${rotation}) scale(${scale}) translate(-150 -140)">
    <path d="${TYPE_PATH[input.type]}" fill="${fill}" stroke="rgba(0,0,0,0.35)" stroke-width="3"/>
    <path d="${TYPE_PATH[input.type]}" fill="rgba(255,255,255,0.18)" transform="translate(4 -4)"/>
  </g>
  <text x="150" y="282" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="#111827">${escaped}</text>
</svg>
`;
}
