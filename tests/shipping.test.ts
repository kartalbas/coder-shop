import fs from "node:fs/promises";
import path from "node:path";
import { HAPPY_PATH } from "@/lib/orders/state-machine";
import { labelSerialLines } from "@/lib/shipping/label-content";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { LabelRequest, ShippingProvider } from "@/lib/shipping/types";

// Issue #34: the pattern is a test expectation, not production code.
const MOCK_TRACKING_PATTERN = /^1Z[0-9A-Z]{15,16}$/;
import { OrderModel, type Order, type OrderStatus } from "@/models/order";
import { MockUpsProvider } from "@/server/shipping/mock";
import { LABELS_DIR, createLabelCore, getLabelFileCore } from "@/server/shipping/label";
import { UpsShippingProvider } from "@/server/shipping/ups";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const FAKE_PDF = Buffer.from("%PDF-1.4 fake label for tests");

const REQUEST: LabelRequest = {
  orderNumber: "B-2026-000001",
  recipient: {
    name: "Lena Meier",
    street: "Bahnhofstrasse 12",
    postalCode: "8001",
    city: "Zürich",
    country: "CH",
    phone: "079 555 01 10",
  },
  parcelWeightGrams: 1150,
  service: "standard",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function upsShipReply(trackingNumber: string): unknown {
  return {
    ShipmentResponse: {
      ShipmentResults: {
        PackageResults: [
          {
            TrackingNumber: trackingNumber,
            ShippingLabel: {
              ImageFormat: { Code: "PDF" },
              GraphicImage: FAKE_PDF.toString("base64"),
            },
          },
        ],
      },
    },
  };
}

describe("labelSerialLines (issue #62 review)", () => {
  it("renders nothing for a quantity order", () => {
    expect(labelSerialLines([])).toEqual([]);
  });

  it("names the header and wraps long serial lists at the line limit", () => {
    const lines = labelSerialLines(["SERIAL-AAAAAAAAAA", "SERIAL-BBBBBBBBBB", "SERIAL-CCCCCCCCCC"], 30);
    expect(lines[0]).toBe("Seriennummern:");
    expect(lines.slice(1).every((line) => line.length <= 30)).toBe(true);
    expect(lines.slice(1).join(" ")).toContain("SERIAL-CCCCCCCCCC");
  });
});

describe("MockUpsProvider", () => {
  it("returns a 1Z tracking number and a real PDF label", async () => {
    const result = await new MockUpsProvider().createLabel(REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trackingNumber).toMatch(MOCK_TRACKING_PATTERN);
    expect(Buffer.from(result.labelPdf.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("renders the serial block on the label for serial orders (#62 review)", async () => {
    const result = await new MockUpsProvider().createLabel({
      ...REQUEST,
      serials: ["IMEI-MOCK-0001", "IMEI-MOCK-0002"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Buffer.from(result.labelPdf.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });
});

describe("UpsShippingProvider (fetch mocked)", () => {
  function makeProvider(fetchMock: typeof fetch) {
    return new UpsShippingProvider({
      clientId: "client-id",
      clientSecret: "client-secret",
      accountNumber: "A12345",
      fetchImpl: fetchMock,
    });
  }

  it("caches the OAuth token until expiry (single token call for repeated labels)", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      String(url).includes("/oauth/token")
        ? jsonResponse({ access_token: "token-1", expires_in: 1800 })
        : jsonResponse(upsShipReply("1ZTESTTRACKING01")),
    );
    const provider = makeProvider(fetchMock as unknown as typeof fetch);

    const first = await provider.createLabel(REQUEST);
    const second = await provider.createLabel(REQUEST);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/oauth/token"),
    );
    expect(tokenCalls).toHaveLength(1);
    const shipCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/ship"));
    expect(shipCalls).toHaveLength(2);
    expect(shipCalls[0][1]?.headers).toMatchObject({ Authorization: "Bearer token-1" });
  });

  it("refreshes the token once it is close to expiry", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("/oauth/token")
        ? jsonResponse({ access_token: "token-x", expires_in: 30 })
        : jsonResponse(upsShipReply("1ZTESTTRACKING02")),
    );
    const provider = makeProvider(fetchMock as unknown as typeof fetch);

    await provider.createLabel(REQUEST);
    await provider.createLabel(REQUEST);

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/oauth/token"));
    expect(tokenCalls).toHaveLength(2);
  });

  it("single-flights concurrent token fetches", async () => {
    let tokenCalls = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/oauth/token")) {
        tokenCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse({ access_token: "token-2", expires_in: 1800 });
      }
      return jsonResponse(upsShipReply("1ZTESTTRACKING03"));
    });
    const provider = makeProvider(fetchMock as unknown as typeof fetch);

    const [a, b] = await Promise.all([provider.createLabel(REQUEST), provider.createLabel(REQUEST)]);
    expect(a.ok && b.ok).toBe(true);
    expect(tokenCalls).toBe(1);
  });

  it("maps a successful UPS reply to tracking + PDF bytes", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("/oauth/token")
        ? jsonResponse({ access_token: "token-3", expires_in: 1800 })
        : jsonResponse(upsShipReply("1ZTESTTRACKING04")),
    );

    const result = await makeProvider(fetchMock as unknown as typeof fetch).createLabel(REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trackingNumber).toBe("1ZTESTTRACKING04");
    expect(Buffer.from(result.labelPdf).equals(FAKE_PDF)).toBe(true);
  });

  it("sends the parcel serials as shipper references, and none for quantity orders (#62 review)", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
      String(url).includes("/oauth/token")
        ? jsonResponse({ access_token: "token-6", expires_in: 1800 })
        : jsonResponse(upsShipReply("1ZTESTTRACKING06")),
    );
    const provider = makeProvider(fetchMock as unknown as typeof fetch);

    await provider.createLabel({ ...REQUEST, serials: ["IMEI-AAA-111", "IMEI-BBB-222"] });
    await provider.createLabel(REQUEST);

    const shipBodies = fetchMock.mock.calls
      .filter(([url]) => String(url).includes("/ship"))
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as {
        ShipmentRequest: { Shipment: Record<string, unknown> };
      });
    expect(shipBodies[0]?.ShipmentRequest.Shipment.ShipperReferences).toEqual([
      { Tag: "SERIAL", Value: "IMEI-AAA-111,IMEI-BBB-222" },
    ]);
    expect(shipBodies[1]?.ShipmentRequest.Shipment.ShipperReferences).toBeUndefined();
  });

  it("maps UPS API errors to a typed failure", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("/oauth/token")
        ? jsonResponse({ access_token: "token-4", expires_in: 1800 })
        : jsonResponse(
            { Error: [{ Code: "120901", Message: "Invalid shipper number" }] },
            400,
          ),
    );

    const result = await makeProvider(fetchMock as unknown as typeof fetch).createLabel(REQUEST);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("120901");
    expect(result.error).toContain("Invalid shipper number");
  });

  it("maps a token endpoint failure to an auth error", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ errors: [{ code: "401", message: "unauthorized" }] }, 401),
    );

    const result = await makeProvider(fetchMock as unknown as typeof fetch).createLabel(REQUEST);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("UPS-Authentifizierung fehlgeschlagen");
  });

  it("fails cleanly when the reply lacks tracking or the label", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("/oauth/token")
        ? jsonResponse({ access_token: "token-5", expires_in: 1800 })
        : jsonResponse({ ShipmentResponse: { ShipmentResults: {} } }),
    );

    const result = await makeProvider(fetchMock as unknown as typeof fetch).createLabel(REQUEST);
    expect(result.ok).toBe(false);
  });
});

describe("shipping provider factory", () => {
  it("uses the mock provider without UPS credentials", async () => {
    vi.resetModules();
    const [{ getShippingProvider }, { MockUpsProvider: FreshMock }] = await Promise.all([
      import("@/server/shipping/provider"),
      import("@/server/shipping/mock"),
    ]);
    expect(getShippingProvider()).toBeInstanceOf(FreshMock);
  });

  it("uses the UPS provider when all three env vars are set", async () => {
    vi.stubEnv("UPS_CLIENT_ID", "id");
    vi.stubEnv("UPS_CLIENT_SECRET", "secret");
    vi.stubEnv("UPS_ACCOUNT", "acct");
    vi.resetModules();
    const [{ getShippingProvider }, { UpsShippingProvider: FreshUps }] = await Promise.all([
      import("@/server/shipping/provider"),
      import("@/server/shipping/ups"),
    ]);
    expect(getShippingProvider()).toBeInstanceOf(FreshUps);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

async function seedOrder(status: OrderStatus, tag: string, serials?: string[]) {
  const statusLog = HAPPY_PATH.slice(0, HAPPY_PATH.indexOf(status) + 1).map((step, index) => ({
    status: step,
    at: new Date(Date.now() - (HAPPY_PATH.indexOf(status) - index) * 60_000),
  }));
  return OrderModel.create({
    orderNumber: `B-2026-8${tag}`,
    status,
    statusLog,
    customer: {
      name: "Lena Meier",
      email: "lena@example.ch",
      phone: "079 555 01 10",
      street: "Bahnhofstrasse 12",
      postalCode: "8001",
      city: "Zürich",
      country: "CH",
    },
    lines: [
      {
        productId: "000000000000000000000000",
        sku: `LB-${tag}-A`,
        name: "Etikett Test A",
        variantLabel: "42 / schwarz",
        qty: 2,
        unitPriceCents: 9900,
        totalCents: 19800,
        weightGrams: 300,
      },
      {
        productId: "000000000000000000000000",
        sku: `LB-${tag}-B`,
        name: "Etikett Test B",
        variantLabel: "128 GB",
        qty: 1,
        unitPriceCents: 4900,
        totalCents: 4900,
        weightGrams: 200,
        ...(serials ? { serials } : {}),
      },
    ],
    totals: { subtotalCents: 24700, shippingCents: 0, totalCents: 24700, vatCents: 1850 },
    shipping: { method: "standard" },
    payment: { method: "mock", kind: "immediate" as const, reference: "P-LABEL" },
  });
}

const failingProvider: ShippingProvider = {
  name: "ups",
  async createLabel() {
    return { ok: false, error: "UPS nicht erreichbar (Test)" };
  },
};

function recordingProvider(captured: LabelRequest[]): ShippingProvider {
  return {
    name: "ups",
    async createLabel(request) {
      captured.push(request);
      return { ok: true, trackingNumber: "1ZRECORDED0000001", labelPdf: FAKE_PDF };
    },
  };
}

describe("createLabelCore", () => {
  const writtenFiles: string[] = [];

  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
  });

  afterAll(async () => {
    await Promise.all(writtenFiles.map((file) => fs.rm(file, { force: true })));
    await disconnectTestDB();
  });

  it("creates a label from packed: tracking, PDF on disk, shipped, parcel weight", async () => {
    const order = await seedOrder("packed", "0001");
    const result = await createLabelCore(order._id.toString(), new MockUpsProvider());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.trackingNumber).toMatch(MOCK_TRACKING_PATTERN);
    const file = path.resolve(result.labelPath);
    writtenFiles.push(file);
    expect(file.startsWith(path.resolve(LABELS_DIR))).toBe(true);

    const pdf = await fs.readFile(file);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    const fresh = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(fresh?.status).toBe("shipped");
    expect(fresh?.shipping.carrier).toBe("ups");
    expect(fresh?.shipping.trackingNumber).toBe(result.trackingNumber);
    expect(fresh?.shipping.parcelWeightGrams).toBe(2 * 300 + 1 * 200 + 150);
    expect(fresh?.statusLog.at(-1)?.status).toBe("shipped");
  });

  it("passes the order's serials to the provider, none for quantity orders (#62 review)", async () => {
    const withSerials = await seedOrder("packed", "0006", ["IMEI-LABEL-1", "IMEI-LABEL-2"]);
    const capturedSerial: LabelRequest[] = [];
    const serialResult = await createLabelCore(
      withSerials._id.toString(),
      recordingProvider(capturedSerial),
    );
    expect(serialResult.ok).toBe(true);
    expect(capturedSerial[0]?.serials).toEqual(["IMEI-LABEL-1", "IMEI-LABEL-2"]);
    if (serialResult.ok) writtenFiles.push(path.resolve(serialResult.labelPath));

    const quantity = await seedOrder("packed", "0007");
    const capturedQuantity: LabelRequest[] = [];
    const quantityResult = await createLabelCore(
      quantity._id.toString(),
      recordingProvider(capturedQuantity),
    );
    expect(quantityResult.ok).toBe(true);
    expect(capturedQuantity[0]?.serials ?? []).toEqual([]);
    if (quantityResult.ok) writtenFiles.push(path.resolve(quantityResult.labelPath));
  });

  it("is idempotent: a second call returns the same tracking and label", async () => {
    const order = await seedOrder("packed", "0002");
    const first = await createLabelCore(order._id.toString(), new MockUpsProvider());
    const second = await createLabelCore(order._id.toString(), failingProvider);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.trackingNumber).toBe(first.trackingNumber);
    expect(second.labelPath).toBe(first.labelPath);
    writtenFiles.push(path.resolve(first.labelPath));
  });

  it("rejects label creation from paid", async () => {
    const order = await seedOrder("paid", "0003");
    const result = await createLabelCore(order._id.toString(), new MockUpsProvider());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("gepackt");
    const fresh = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(fresh?.status).toBe("paid");
  });

  it("keeps the order packed when the provider fails", async () => {
    const order = await seedOrder("packed", "0004");
    const result = await createLabelCore(order._id.toString(), failingProvider);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Test");
    const fresh = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(fresh?.status).toBe("packed");
    expect(fresh?.shipping.trackingNumber).toBeUndefined();
  });

  it("returns an error for an unknown order", async () => {
    const result = await createLabelCore("000000000000000000000000", new MockUpsProvider());
    expect(result.ok).toBe(false);
  });

  it("keeps the order packed when the label PDF cannot be written, and a retry succeeds (issue #16)", async () => {
    const order = await seedOrder("packed", "0005");
    const dir = path.resolve(LABELS_DIR);
    await fs.mkdir(dir, { recursive: true });
    await fs.chmod(dir, 0o500);
    try {
      const result = await createLabelCore(order._id.toString(), new MockUpsProvider());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("storage_error");
      const blocked = await OrderModel.findById(order._id).lean<Order>().exec();
      expect(blocked?.status).toBe("packed");
      expect(blocked?.shipping.trackingNumber).toBeUndefined();
    } finally {
      await fs.chmod(dir, 0o755);
    }

    const retry = await createLabelCore(order._id.toString(), new MockUpsProvider());
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    writtenFiles.push(path.resolve(retry.labelPath));
    const pdf = await fs.readFile(path.resolve(retry.labelPath));
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const fresh = await OrderModel.findById(order._id).lean<Order>().exec();
    expect(fresh?.status).toBe("shipped");
  });
});

describe("getLabelFileCore (issue #32)", () => {
  const cleanup: string[] = [];

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await Promise.all(cleanup.map((file) => fs.rm(file, { force: true })));
  });

  it("serves the label PDF of an order that has one", async () => {
    const order = await seedOrder("packed", "9001");
    const label = await createLabelCore(order._id.toString(), new MockUpsProvider());
    expect(label.ok).toBe(true);
    if (!label.ok) return;
    cleanup.push(path.resolve(label.labelPath));

    const result = await getLabelFileCore(order._id.toString());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderNumber).toBe(order.orderNumber);
    expect(result.pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("refuses a label path that escapes the labels directory", async () => {
    const order = await seedOrder("packed", "9002");
    await OrderModel.updateOne(
      { _id: order._id },
      { $set: { "shipping.labelPath": "data/labels/../../.env" } },
    );
    const result = await getLabelFileCore(order._id.toString());
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("404s when the recorded file is gone, when there is no label and for bad ids", async () => {
    const order = await seedOrder("packed", "9003");
    await OrderModel.updateOne(
      { _id: order._id },
      { $set: { "shipping.labelPath": "data/labels/B-2026-999999.pdf" } },
    );
    expect(await getLabelFileCore(order._id.toString())).toMatchObject({
      ok: false,
      status: 404,
    });

    const noLabel = await seedOrder("packed", "9004");
    expect(await getLabelFileCore(noLabel._id.toString())).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await getLabelFileCore("kein-object-id")).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});
