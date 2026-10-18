import type { Formatters } from "@/lib/format";

interface LabelRecipient {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone?: string;
}

export interface LabelRequest {
  orderNumber: string;
  recipient: LabelRecipient;
  parcelWeightGrams: number;
  service: "standard" | "express";
  // Issue #62 (#54): the exact serial numbers of the parcel's serial-tracked pieces
  // (packing slip, label data and invoice all carry them); quantity orders have none.
  serials?: string[];
  // #58 decision point 3: the label goes to the customer, so its printed texts render
  // from the translation table in the *order's* stored language — the server resolves
  // the label map and hands it along as plain data; providers that send API JSON
  // (real UPS) simply ignore it.
  labels: Readonly<Record<string, string>>;
  // #58 review: the same Intl set the label map came from — a rendering provider
  // formats the parcel weight through it (fr-CH prints "1,15 kg"); API-JSON
  // providers keep machine formats and ignore it.
  formatters: Formatters;
}

export type LabelResult =
  | { ok: true; trackingNumber: string; labelPdf: Uint8Array }
  | { ok: false; error: string };

export interface ShippingProvider {
  readonly name: "ups";
  createLabel(request: LabelRequest): Promise<LabelResult>;
}

