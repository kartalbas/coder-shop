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
}

export type LabelResult =
  | { ok: true; trackingNumber: string; labelPdf: Uint8Array }
  | { ok: false; error: string };

export interface ShippingProvider {
  readonly name: "ups";
  createLabel(request: LabelRequest): Promise<LabelResult>;
}

