import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "@/models/user";
import { hashPassword } from "@/server/password";
import {
  createSessionToken,
  loginCore,
  resetLoginThrottle,
  signSessionToken,
  verifySessionToken,
} from "@/server/session";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";

const SECRET = "test-secret";

describe("session tokens", () => {
  it("round-trips a signed payload", () => {
    const token = signSessionToken({ userId: "u1", exp: Date.now() + 60_000 }, SECRET);
    expect(verifySessionToken(token, SECRET)).toEqual({ userId: "u1", exp: expect.any(Number) });
  });

  it("rejects a forged signature", () => {
    const token = signSessionToken({ userId: "u1", exp: Date.now() + 60_000 }, SECRET);
    const [body] = token.split(".");
    const forged = `${body}.${"A".repeat(43)}`;
    expect(verifySessionToken(forged, SECRET)).toBeNull();
    expect(verifySessionToken(`${body}.`, SECRET)).toBeNull();
    expect(verifySessionToken("not-a-token", SECRET)).toBeNull();
  });

  it("rejects a tampered payload (signature covers the payload)", () => {
    const token = signSessionToken({ userId: "u1", exp: Date.now() + 60_000 }, SECRET);
    const [, mac] = token.split(".");
    const evilBody = Buffer.from(JSON.stringify({ userId: "admin", exp: Date.now() + 60_000 })).toString(
      "base64url",
    );
    expect(verifySessionToken(`${evilBody}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const token = signSessionToken({ userId: "u1", exp: Date.now() - 1_000 }, SECRET);
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken("u1");
    expect(verifySessionToken(token, "other-secret")).toBeNull();
  });
});

describe("loginCore", () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    await UserModel.create({
      email: "admin@codershop.ch",
      name: "Shop Admin",
      passwordHash: await hashPassword("Admin!2026"),
      role: "admin",
    });
  });

  afterAll(disconnectTestDB);

  beforeEach(() => {
    resetLoginThrottle();
  });

  it("returns a valid session cookie for the seeded credentials", async () => {
    const result = await loginCore("admin@codershop.ch", "Admin!2026", { ip: "10.0.0.1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payload = verifySessionToken(result.token);
    expect(payload).not.toBeNull();
    const user = await UserModel.findOne({ email: "admin@codershop.ch" }).exec();
    expect(payload?.userId).toBe(user?._id.toString());
    expect(payload!.exp).toBeGreaterThan(Date.now());
  });

  it("rejects a wrong password", async () => {
    const result = await loginCore("admin@codershop.ch", "falsch", { ip: "10.0.0.2" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown account", async () => {
    const result = await loginCore("niemand@example.ch", "egal", { ip: "10.0.0.3" });
    expect(result.ok).toBe(false);
  });

  it("throttles after five failed attempts, even with the right password", async () => {
    const ip = "10.0.0.4";
    for (let i = 0; i < 5; i++) {
      const attempt = await loginCore("admin@codershop.ch", "falsch", { ip });
      expect(attempt.ok).toBe(false);
    }
    const blocked = await loginCore("admin@codershop.ch", "Admin!2026", { ip });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toContain("Zu viele Fehlversuche");

    const otherIp = await loginCore("admin@codershop.ch", "Admin!2026", { ip: "10.0.0.5" });
    expect(otherIp.ok).toBe(true);
  });
});
