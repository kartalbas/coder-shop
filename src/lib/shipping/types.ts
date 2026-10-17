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
}

export type LabelResult =
  | { ok: true; trackingNumber: string; labelPdf: Uint8Array }
  | { ok: false; error: string };

export interface ShippingProvider {
  readonly name: "ups";
  createLabel(request: LabelRequest): Promise<LabelResult>;
}

