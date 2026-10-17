import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "@/models/user";
import { hashPassword } from "@/server/password";
import {
  changePasswordCore,
  createSessionToken,
  loginCore,
  resetLoginThrottle,
  resolveClientIp,
  resolveSessionUserId,
  signSessionToken,
  verifySessionToken,
} from "@/server/session";
import {
  MIN_PRODUCTION_SECRET_LENGTH,
  resolveSessionSecret,
  sessionSecret,
} from "@/server/session-token";
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

describe("session secret resolution", () => {
  const longSecret = "s".repeat(MIN_PRODUCTION_SECRET_LENGTH);

  it("refuses to run production without a configured secret", () => {
    expect(() =>
      resolveSessionSecret({
        configured: undefined,
        isProduction: true,
        generate: () => "generated",
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("refuses a weak secret in production", () => {
    expect(() =>
      resolveSessionSecret({
        configured: "kurz",
        isProduction: true,
        generate: () => "generated",
      }),
    ).toThrow(/too weak/i);
  });

  it("accepts a strong secret in production", () => {
    expect(
      resolveSessionSecret({ configured: longSecret, isProduction: true, generate: () => "x" }),
    ).toBe(longSecret);
  });

  it("uses a random per-process secret outside production, never a source-code constant", () => {
    let calls = 0;
    const secret = resolveSessionSecret({
      configured: undefined,
      isProduction: false,
      generate: () => `generated-${++calls}`,
    });
    expect(secret).toBe("generated-1");
    const live = sessionSecret();
    expect(live.length).toBeGreaterThanOrEqual(32);
    expect(live).not.toBe("coder-shop-dev-session-secret-change-me");
    expect(sessionSecret()).toBe(live);
  });

  it("sessionSecret() throws in production when SESSION_SECRET is unset", () => {
    const mutableEnv = process.env as { NODE_ENV?: string };
    const previous = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      expect(() => sessionSecret()).toThrow(/SESSION_SECRET/);
    } finally {
      mutableEnv.NODE_ENV = previous;
    }
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
  });

  it("throttles the account even when every attempt claims a different IP (issue #5)", async () => {
    for (let i = 0; i < 5; i++) {
      const attempt = await loginCore("admin@codershop.ch", "falsch", { ip: `10.1.${i}.${i}` });
      expect(attempt.ok).toBe(false);
    }
    const freshIp = await loginCore("admin@codershop.ch", "Admin!2026", { ip: "10.2.55.1" });
    expect(freshIp.ok).toBe(false);
    if (!freshIp.ok) expect(freshIp.error).toContain("Zu viele Fehlversuche");
  });
});

describe("resolveClientIp", () => {
  const headersOf = (values: Record<string, string>) => (name: string) => values[name] ?? null;

  it("ignores X-Forwarded-For unless a proxy is trusted", () => {
    expect(
      resolveClientIp(headersOf({ "x-forwarded-for": "1.2.3.4" }), false),
    ).toBe("unknown");
  });

  it("uses the last X-Forwarded-For entry behind a trusted proxy (own proxy appends the peer)", () => {
    expect(
      resolveClientIp(headersOf({ "x-forwarded-for": "9.9.9.9, 203.0.113.7, 10.0.0.1" }), true),
    ).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(resolveClientIp(headersOf({ "x-real-ip": "203.0.113.9" }), true)).toBe("203.0.113.9");
    expect(resolveClientIp(headersOf({}), true)).toBe("unknown");
  });
});

describe("resolveSessionUserId", () => {
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

  it("accepts a validly signed token for an existing user", async () => {
    const user = await UserModel.findOne({ email: "admin@codershop.ch" }).exec();
    const token = createSessionToken(user!._id.toString());
    expect(await resolveSessionUserId(token)).toBe(user!._id.toString());
  });

  it("rejects a correctly signed token for a user that does not exist", async () => {
    const token = createSessionToken("507f1f77bcf86cd799439011");
    expect(await resolveSessionUserId(token)).toBeNull();
  });

  it("rejects a token for a user that was deleted after login", async () => {
    const user = await UserModel.create({
      email: "temp@codershop.ch",
      name: "Temp Admin",
      passwordHash: await hashPassword("Temp!2026"),
      role: "admin",
    });
    const token = createSessionToken(user._id.toString());
    expect(await resolveSessionUserId(token)).toBe(user._id.toString());
    await UserModel.deleteOne({ _id: user._id });
    expect(await resolveSessionUserId(token)).toBeNull();
  });

  it("rejects forged or empty tokens", async () => {
    expect(await resolveSessionUserId(undefined)).toBeNull();
    expect(await resolveSessionUserId("gibts-nicht")).toBeNull();
  });
});

describe("changePasswordCore", () => {
  let userId: string;

  beforeAll(async () => {
    await connectTestDB();
    await clearCollections();
    const user = await UserModel.create({
      email: "admin@codershop.ch",
      name: "Shop Admin",
      passwordHash: await hashPassword("Admin!2026"),
      role: "admin",
    });
    userId = user._id.toString();
  });

  afterAll(disconnectTestDB);

  beforeEach(() => {
    resetLoginThrottle();
  });

  it("rejects a wrong current password", async () => {
    const result = await changePasswordCore(userId, "falsch", "Neues!Passwort1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/aktuell/i);
  });

  it("rejects a too-short new password", async () => {
    const result = await changePasswordCore(userId, "Admin!2026", "kurz");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/10 Zeichen/);
  });

  it("changes the password and the new one logs in", async () => {
    expect((await changePasswordCore(userId, "Admin!2026", "Neues!Passwort1")).ok).toBe(true);
    expect((await loginCore("admin@codershop.ch", "Admin!2026", { ip: "10.9.9.9" })).ok).toBe(
      false,
    );
    expect(
      (await loginCore("admin@codershop.ch", "Neues!Passwort1", { ip: "10.9.9.8" })).ok,
    ).toBe(true);
  });
});
