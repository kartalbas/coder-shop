import type { LabelRequest, LabelResult, ShippingProvider } from "@/lib/shipping/types";

const UPS_TOKEN_URL = "https://www.ups.com/security/v1/oauth/token";
const UPS_BASE_URL = "https://onlinetools.ups.com";
const UPS_SHIP_RESOURCE = "api/shipments/v2409/ship";

const TOKEN_EXPIRY_MARGIN_SECONDS = 60;

const SERVICE_CODES: Record<LabelRequest["service"], string> = {
  standard: "11",
  express: "14",
};

export interface UpsShippingProviderOptions {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  tokenUrl?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

interface UpsErrorBody {
  Error?: Array<{ Code?: string; Message?: string; ErrorDescription?: string }>;
  errors?: Array<{ code?: string; message?: string }>;
  response?: { errors?: Array<{ code?: string; message?: string }> };
}

function firstErrorMessage(status: number, body: UpsErrorBody): string {
  const legacy = body.Error?.[0];
  if (legacy) {
    const message = legacy.Message ?? legacy.ErrorDescription ?? "unbekannter Fehler";
    return `UPS-Fehler ${legacy.Code ?? status}: ${message}`;
  }
  const modern =
    body.errors?.[0]?.message ?? body.response?.errors?.[0]?.message ?? "unbekannter Fehler";
  return `UPS-Fehler ${status}: ${modern}`;
}

export class UpsShippingProvider implements ShippingProvider {
  readonly name = "ups" as const;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accountNumber: string;
  private readonly tokenUrl: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  private cachedToken: CachedToken | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(options: UpsShippingProviderOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.accountNumber = options.accountNumber;
    this.tokenUrl = options.tokenUrl ?? UPS_TOKEN_URL;
    this.baseUrl = options.baseUrl ?? UPS_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async fetchToken(): Promise<string> {
    const response = await this.fetchImpl(this.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as UpsErrorBody;
      throw new Error(firstErrorMessage(response.status, body));
    }
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token || typeof body.expires_in !== "number") {
      throw new Error("UPS-Token-Antwort ohne access_token/expires_in");
    }
    this.cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in - TOKEN_EXPIRY_MARGIN_SECONDS) * 1000,
    };
    return body.access_token;
  }

  async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) return this.cachedToken.value;
    this.pendingToken ??= this.fetchToken().finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private buildShipRequest(request: LabelRequest): unknown {
    const kilograms = (request.parcelWeightGrams / 1000).toFixed(2);
    return {
      ShipmentRequest: {
        Request: {
          SubVersion: "v2409",
          RequestOption: "validate",
          TransactionReference: { CustomerContext: request.orderNumber },
        },
        Shipment: {
          Description: `coder-shop ${request.orderNumber}`,
          DocumentsOnlyIndicator: "N",
          Shipper: {
            Name: "coder-shop",
            ShipperNumber: this.accountNumber,
            Phone: { Number: "000-000-0000" },
            Address: {
              AddressLine: ["coder-shop"],
              City: "Zuerich",
              PostalCode: "8001",
              CountryCode: "CH",
            },
          },
          ShipTo: {
            Name: request.recipient.name,
            Phone: { Number: (request.recipient.phone ?? "000-000-0000").replace(/\D/g, "") || "0000000000" },
            Address: {
              AddressLine: [request.recipient.street],
              City: request.recipient.city,
              PostalCode: request.recipient.postalCode,
              CountryCode: request.recipient.country,
            },
          },
          Service: {
            Code: SERVICE_CODES[request.service],
            Description: request.service === "express" ? "UPS Express" : "UPS Standard",
          },
          PaymentInformation: {
            ShipmentCharge: {
              Type: "01",
              BillShipper: { AccountNumber: this.accountNumber },
            },
          },
          ShipmentRatingOptions: { NegotiatedRatesIndicator: "Y" },
          Package: {
            Description: `Paket ${request.orderNumber}`,
            Packaging: { Code: "02", Description: "Customer Package" },
            PackageWeight: {
              UnitOfMeasurement: { Code: "KGS" },
              Weight: kilograms,
            },
          },
          LabelImageFormat: { Code: "PDF" },
        },
      },
    };
  }

  async createLabel(request: LabelRequest): Promise<LabelResult> {
    let token: string;
    try {
      token = await this.getToken();
    } catch (error) {
      return { ok: false, error: `UPS-Authentifizierung fehlgeschlagen: ${String(error)}` };
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/${UPS_SHIP_RESOURCE}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          transId: request.orderNumber,
          transactionSrc: "coder-shop",
        },
        body: JSON.stringify(this.buildShipRequest(request)),
      });
    } catch (error) {
      return { ok: false, error: `UPS nicht erreichbar: ${String(error)}` };
    }

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: firstErrorMessage(response.status, body as UpsErrorBody) };
    }

    const shipmentResponse = body as {
      ShipmentResponse?: {
        ShipmentResults?: {
          PackageResults?: Array<{
            TrackingNumber?: string;
            ShippingLabel?: { GraphicImage?: string };
          }>;
        };
      };
    };
    const pack = shipmentResponse.ShipmentResponse?.ShipmentResults?.PackageResults?.[0];
    const trackingNumber = pack?.TrackingNumber;
    const labelBase64 = pack?.ShippingLabel?.GraphicImage;
    if (!trackingNumber || !labelBase64) {
      return { ok: false, error: "UPS-Antwort ohne Sendungsnummer oder Etiketten-PDF." };
    }

    return {
      ok: true,
      trackingNumber,
      labelPdf: Buffer.from(labelBase64, "base64"),
    };
  }
}
