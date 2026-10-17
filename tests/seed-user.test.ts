import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "@/models/user";
import { hashPassword, verifyPassword } from "@/server/password";
import { clearCollections, connectTestDB, disconnectTestDB } from "@/test/db";
// Importing the seed script under Vitest must not run main() (guarded via process.env.VITEST).
import { seedUser } from "../scripts/seed/seed";

const env = process.env as Record<string, string | undefined>;

async function passwordHashOfAdmin(): Promise<string> {
  const user = await UserModel.findOne({ email: "admin@codershop.ch" }).exec();
  if (!user) throw new Error("admin user missing");
  return user.passwordHash;
}

describe("seedUser (issue #4: password is not a source-code constant)", () => {
  beforeAll(connectTestDB);
  afterAll(disconnectTestDB);

  beforeEach(async () => {
    await clearCollections();
    delete env.ADMIN_PASSWORD;
  });

  it("seeds the admin with ADMIN_PASSWORD when given", async () => {
    env.ADMIN_PASSWORD = "Start!Passwort1";
    const result = await seedUser();
    expect(result.created).toBe(true);
    expect(result.generatedPassword).toBeUndefined();
    expect(await verifyPassword("Start!Passwort1", await passwordHashOfAdmin())).toBe(true);
  });

  it("generates a random password when ADMIN_PASSWORD is unset and shows it once", async () => {
    const first = await seedUser();
    expect(first.created).toBe(true);
    expect(first.generatedPassword).toBeDefined();
    expect((first.generatedPassword ?? "").length).toBeGreaterThanOrEqual(12);
    expect(await verifyPassword(first.generatedPassword!, await passwordHashOfAdmin())).toBe(true);

    const second = await seedUser();
    expect(second.created).toBe(false);
    expect(second.generatedPassword).toBeUndefined();
  });

  it("a re-seed never resets a changed password", async () => {
    env.ADMIN_PASSWORD = "Urspruenglich1!";
    await seedUser();
    const user = await UserModel.findOne({ email: "admin@codershop.ch" }).exec();
    user!.passwordHash = await hashPassword("Geaendert!99");
    await user!.save();

    env.ADMIN_PASSWORD = "Urspruenglich1!";
    const again = await seedUser();
    expect(again.created).toBe(false);
    expect(await verifyPassword("Geaendert!99", await passwordHashOfAdmin())).toBe(true);
    expect(await verifyPassword("Urspruenglich1!", await passwordHashOfAdmin())).toBe(false);
  });
});
