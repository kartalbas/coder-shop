import { createHash, randomBytes } from "node:crypto";
import { absoluteUrl } from "@/lib/site";
import {
  addressSchema,
  claimOrderSchema,
  registerSchema,
  validateCustomerPassword,
  type AddressInput,
} from "@/lib/validations/account";
import { OrderModel } from "@/models/order";
import { PasswordResetModel } from "@/models/password-reset";
import { UserModel, type CustomerAddress } from "@/models/user";
import { connectDB } from "./db";
import { hashPassword } from "./password";
import { sendMail } from "./mail";
import { passwordResetMail, welcomeMail } from "@/lib/mail-templates";
import { createLimiter, LimiterBusyError } from "./limiter";
import { createRateLimiter } from "./rate-limit";

// scrypt on registration too — bound the parallelism like the login path.
const scryptLimiter = createLimiter(2, 8);

// Registration and reset requests are the two places where a bot could create junk;
// the windows are far above any real human usage.
const registerLimit = createRateLimiter(5, 60 * 60 * 1000);
const resetRequestLimit = createRateLimiter(3, 60 * 60 * 1000);

export function resetCustomerRateLimits(): void {
  registerLimit.reset();
  resetRequestLimit.reset();
}

export type CustomerAuthResult =
  | { ok: true; userId: string; email: string; name: string }
  | { ok: false; error: string };

export async function registerCustomerCore(
  input: unknown,
  opts: { ip?: string } = {},
): Promise<CustomerAuthResult> {
  const limit = registerLimit.check(opts.ip ?? "local");
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Zu viele Registrierungen in kurzer Folge. Bitte in ${limit.retryInSeconds} Sekunden erneut versuchen.`,
    };
  }
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  const email = parsed.data.email.trim().toLowerCase();

  await connectDB();
  const existing = await UserModel.exists({ email });
  if (existing) {
    // Registration must tell the user the address is taken — that is the accepted
    // trade-off for a usable sign-up form (recorded in DECISIONS).
    return { ok: false, error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  let passwordHash: string;
  try {
    passwordHash = await scryptLimiter.run(() => hashPassword(parsed.data.password));
  } catch (error) {
    if (error instanceof LimiterBusyError) {
      return { ok: false, error: "Zu viele gleichzeitige Registrierungen. Bitte gleich erneut versuchen." };
    }
    throw error;
  }

  const user = await UserModel.create({
    email,
    name: parsed.data.name,
    passwordHash,
    role: "customer",
  });
  await sendMail({ to: email, ...welcomeMail(parsed.data.name) });
  return { ok: true, userId: user._id.toString(), email, name: user.name };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const RESET_SENT = "Falls die Adresse registriert ist, senden wir ihr einen Link zum Passwort-Zurücksetzen.";

// Always answers the same sentence — the response must not reveal whether the e-mail
// belongs to an account.
export async function requestPasswordResetCore(
  email: string,
  opts: { ip?: string } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const limit = resetRequestLimit.check(opts.ip ?? "local");
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Zu viele Anfragen. Bitte in ${limit.retryInSeconds} Sekunden erneut versuchen.`,
    };
  }
  await connectDB();
  const user = await UserModel.findOne({
    email: email.trim().toLowerCase(),
    role: "customer",
  })
    .select("_id name email")
    .lean()
    .exec();
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await PasswordResetModel.create({
      _id: hashResetToken(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    const link = absoluteUrl(`/account/reset-password?token=${token}`);
    await sendMail({ to: user.email, ...passwordResetMail(user.name, link) });
  }
  return { ok: true };
}

export async function resetPasswordCore(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invalid = { ok: false as const, error: "Der Link ist ungültig oder abgelaufen." };
  if (!token) return invalid;
  const passwordError = validateCustomerPassword(newPassword);
  if (passwordError) return { ok: false, error: passwordError };

  await connectDB();
  const entry = await PasswordResetModel.findOne({ _id: hashResetToken(token) }).exec();
  if (!entry || entry.usedAt || entry.expiresAt.getTime() < Date.now()) return invalid;
  entry.usedAt = new Date();
  await entry.save();

  const user = await UserModel.findById(entry.userId).exec();
  if (!user || user.role !== "customer") return invalid;
  user.passwordHash = await hashPassword(newPassword);
  // The reset is also a sign-out: every old session stops working.
  user.sessionsInvalidBefore = new Date();
  await user.save();
  await PasswordResetModel.deleteMany({ userId: user._id });
  return { ok: true };
}

export interface CustomerProfile {
  userId: string;
  name: string;
  email: string;
  addresses: (CustomerAddress & { id: string })[];
}

type LeanAddress = CustomerAddress & { _id: unknown };
type LeanCustomer = { name: string; email: string; role: string; addresses?: LeanAddress[] };

export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  await connectDB();
  const user = await UserModel.findById(userId)
    .select("name email role addresses")
    .lean<LeanCustomer | null>()
    .exec();
  if (!user || user.role !== "customer") return null;
  return {
    userId,
    name: user.name,
    email: user.email,
    addresses: (user.addresses ?? []).map((address) => ({
      label: address.label,
      street: address.street,
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
      kind: address.kind,
      isDefault: address.isDefault,
      id: String(address._id),
    })),
  };
}

function normalizeAddress(input: AddressInput) {
  return {
    label: input.label,
    street: input.street,
    postalCode: input.postalCode,
    city: input.city,
    country: "CH",
    kind: input.kind,
    isDefault: input.isDefault,
  };
}

// Exactly one default per kind; choosing a new one clears the old ones.
function applyDefault(addresses: CustomerAddress[], saved: CustomerAddress): void {
  if (!saved.isDefault) return;
  for (const address of addresses) {
    if (address !== saved && address.kind === saved.kind) address.isDefault = false;
  }
}

export async function saveAddressCore(
  userId: string,
  input: unknown,
  addressId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  await connectDB();
  const user = await UserModel.findById(userId).exec();
  if (!user || user.role !== "customer") return { ok: false, error: "Konto nicht gefunden." };

  const data = normalizeAddress(parsed.data);
  const addresses = user.addresses as unknown as (CustomerAddress & {
    _id: { toString(): string };
  })[];
  if (addressId) {
    const address = addresses.find((entry) => entry._id.toString() === addressId);
    if (!address) return { ok: false, error: "Adresse nicht gefunden." };
    Object.assign(address, data);
    applyDefault(addresses, address);
  } else {
    if (addresses.length >= 10) return { ok: false, error: "Maximal 10 Adressen." };
    addresses.push(data as (typeof addresses)[number]);
    applyDefault(addresses, addresses[addresses.length - 1]);
  }
  await user.save();
  return { ok: true };
}

export async function deleteAddressCore(
  userId: string,
  addressId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await connectDB();
  const user = await UserModel.findById(userId).exec();
  if (!user || user.role !== "customer") return { ok: false, error: "Konto nicht gefunden." };
  const addresses = user.addresses as unknown as { _id: { toString(): string } }[];
  const before = addresses.length;
  user.addresses = addresses.filter((address) => address._id.toString() !== addressId);
  if (user.addresses.length === before) return { ok: false, error: "Adresse nicht gefunden." };
  await user.save();
  return { ok: true };
}

// A guest order becomes part of the account once the buyer proves the order's e-mail.
export async function claimOrderCore(
  userId: string,
  input: unknown,
): Promise<{ ok: true; orderNumber: string } | { ok: false; error: string }> {
  const parsed = claimOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  }
  await connectDB();
  const user = await UserModel.findById(userId).select("email role").lean().exec();
  if (!user || user.role !== "customer") return { ok: false, error: "Konto nicht gefunden." };

  const order = await OrderModel.findOne({
    orderNumber: parsed.data.orderNumber.toUpperCase(),
  })
    .select("orderNumber userId customer.email")
    .exec();
  if (!order) {
    return { ok: false, error: "Bestellung nicht gefunden. Bitte Nummer prüfen." };
  }
  if (order.userId && !order.userId.equals(user._id)) {
    return { ok: false, error: "Diese Bestellung gehört bereits einem anderen Konto." };
  }
  if (order.customer.email.trim().toLowerCase() !== user.email) {
    return { ok: false, error: "Die E-Mail der Bestellung stimmt nicht mit Ihrem Konto überein." };
  }
  order.userId = user._id;
  await order.save();
  return { ok: true, orderNumber: order.orderNumber };
}
