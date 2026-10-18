import { createHash, randomBytes } from "node:crypto";
import { interpolate, label } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";
import { absoluteUrl } from "@/lib/site";
import {
  createAddressSchema,
  createClaimOrderSchema,
  createRegisterSchema,
  validateCustomerPassword,
  type AddressInput,
} from "@/lib/validations/account";
import { OrderModel } from "@/models/order";
import { PasswordResetModel } from "@/models/password-reset";
import { UserModel, type CustomerAddress } from "@/models/user";
import { connectDB } from "./db";
import { getLabels, getRequestLabels, getRequestLanguage } from "./i18n";
import { getMailContext } from "./mail-context";
import { hashPassword } from "./password";
import { sendMail } from "./mail";
import { passwordResetMail, welcomeMail } from "@/lib/mail-templates";
import { createLimiter, LimiterBusyError } from "./limiter";
import { createRateLimiter } from "./rate-limit";
import { env } from "./env";

// scrypt on registration too — bound the parallelism like the login path.
const scryptLimiter = createLimiter(2, 8);

// Registration and reset requests are the two places where a bot could create junk;
// the windows are far above any real human usage. Both ceilings are configuration
// (CUSTOMER_REGISTER_LIMIT_PER_HOUR, CUSTOMER_RESET_LIMIT_PER_HOUR) so deployments and
// the e2e suite can raise them without a code change.
const registerLimit = createRateLimiter(env.customerRegisterLimitPerHour, 60 * 60 * 1000);
const resetRequestLimit = createRateLimiter(env.customerResetLimitPerHour, 60 * 60 * 1000);

export function resetCustomerRateLimits(): void {
  registerLimit.reset();
  resetRequestLimit.reset();
}

export type CustomerAuthResult =
  | { ok: true; userId: string; email: string; name: string }
  // `reason` lets callers branch on the refusal without matching its (now localized)
  // text — the register form highlights the e-mail field on "emailTaken" (#60).
  | { ok: false; error: string; reason?: "emailTaken" };

export async function registerCustomerCore(
  input: unknown,
  opts: { ip?: string } = {},
): Promise<CustomerAuthResult> {
  // #58: every refusal of this core answers in the request language — the rows are
  // process-cached, so resolving them up front costs no I/O inside the flow. The
  // language is stored on the account (#58 decision point 3): it is the language the
  // welcome mail and every later account mail render in.
  const language = await getRequestLanguage();
  const labels = await getLabels(language);
  const limit = registerLimit.check(opts.ip ?? "local");
  if (!limit.allowed) {
    return {
      ok: false,
      error: interpolate(label(labels, "shop.account.error.registerThrottled"), {
        seconds: limit.retryInSeconds,
      }),
    };
  }
  const parsed = createRegisterSchema(labels).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm") };
  }
  const email = parsed.data.email.trim().toLowerCase();

  await connectDB();
  const existing = await UserModel.exists({ email });
  if (existing) {
    // Registration must tell the user the address is taken — that is the accepted
    // trade-off for a usable sign-up form (recorded in DECISIONS).
    return { ok: false, error: label(labels, "shop.account.error.emailTaken"), reason: "emailTaken" };
  }

  let passwordHash: string;
  try {
    passwordHash = await scryptLimiter.run(() => hashPassword(parsed.data.password));
  } catch (error) {
    if (error instanceof LimiterBusyError) {
      return { ok: false, error: label(labels, "shop.account.error.registerBusy") };
    }
    throw error;
  }

  const user = await UserModel.create({
    email,
    name: parsed.data.name,
    passwordHash,
    role: "customer",
    language,
  });
  await sendMail({ to: email, ...welcomeMail(await getMailContext(language), parsed.data.name) });
  return { ok: true, userId: user._id.toString(), email, name: user.name };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Always answers the same sentence — the response must not reveal whether the e-mail
// belongs to an account.
export function resetSentMessage(labels: Readonly<Record<string, string>>): string {
  return label(labels, "shop.account.error.resetSent");
}

export async function requestPasswordResetCore(
  email: string,
  opts: { ip?: string } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const labels = await getRequestLabels();
  const limit = resetRequestLimit.check(opts.ip ?? "local");
  if (!limit.allowed) {
    return {
      ok: false,
      error: interpolate(label(labels, "shop.account.error.resetThrottled"), {
        seconds: limit.retryInSeconds,
      }),
    };
  }
  await connectDB();
  const user = await UserModel.findOne({
    email: email.trim().toLowerCase(),
    role: "customer",
  })
    .select("_id name email language")
    .lean()
    .exec();
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await PasswordResetModel.create({
      _id: hashResetToken(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    // #58 decision point 3: the reset mail renders in the account's mail language and
    // links into it — the request language only ever answered the refusal above.
    const ctx = await getMailContext(user.language);
    const link = absoluteUrl(
      localizedPath(ctx.language, `/account/reset-password?token=${token}`),
    );
    await sendMail({ to: user.email, ...passwordResetMail(ctx, user.name, link) });
  }
  return { ok: true };
}

export async function resetPasswordCore(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const labels = await getRequestLabels();
  const invalid = { ok: false as const, error: label(labels, "shop.account.error.resetLinkInvalid") };
  if (!token) return invalid;
  const passwordError = validateCustomerPassword(newPassword, labels);
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

// One customer carries a bounded address book; the ceiling shows up in the refusal
// text as {max}, so the number keeps its single source here.
const MAX_ADDRESSES_PER_CUSTOMER = 10;

export async function saveAddressCore(
  userId: string,
  input: unknown,
  addressId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const labels = await getRequestLabels();
  const parsed = createAddressSchema(labels).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm") };
  }
  await connectDB();
  const user = await UserModel.findById(userId).exec();
  if (!user || user.role !== "customer") {
    return { ok: false, error: label(labels, "shop.account.error.notFound") };
  }

  const data = normalizeAddress(parsed.data);
  const addresses = user.addresses as unknown as (CustomerAddress & {
    _id: { toString(): string };
  })[];
  if (addressId) {
    const address = addresses.find((entry) => entry._id.toString() === addressId);
    if (!address) return { ok: false, error: label(labels, "shop.account.error.addressNotFound") };
    Object.assign(address, data);
    applyDefault(addresses, address);
  } else {
    if (addresses.length >= MAX_ADDRESSES_PER_CUSTOMER) {
      return {
        ok: false,
        error: interpolate(label(labels, "shop.account.error.addressLimit"), {
          max: MAX_ADDRESSES_PER_CUSTOMER,
        }),
      };
    }
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
  const labels = await getRequestLabels();
  await connectDB();
  const user = await UserModel.findById(userId).exec();
  if (!user || user.role !== "customer") {
    return { ok: false, error: label(labels, "shop.account.error.notFound") };
  }
  const addresses = user.addresses as unknown as { _id: { toString(): string } }[];
  const before = addresses.length;
  user.addresses = addresses.filter((address) => address._id.toString() !== addressId);
  if (user.addresses.length === before) {
    return { ok: false, error: label(labels, "shop.account.error.addressNotFound") };
  }
  await user.save();
  return { ok: true };
}

// A guest order becomes part of the account once the buyer proves the order's e-mail.
export async function claimOrderCore(
  userId: string,
  input: unknown,
): Promise<{ ok: true; orderNumber: string } | { ok: false; error: string }> {
  const labels = await getRequestLabels();
  const parsed = createClaimOrderSchema(labels).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? label(labels, "shop.action.invalidForm") };
  }
  await connectDB();
  const user = await UserModel.findById(userId).select("email role").lean().exec();
  if (!user || user.role !== "customer") {
    return { ok: false, error: label(labels, "shop.account.error.notFound") };
  }

  const order = await OrderModel.findOne({
    orderNumber: parsed.data.orderNumber.toUpperCase(),
  })
    .select("orderNumber userId customer.email")
    .exec();
  if (!order) {
    return { ok: false, error: label(labels, "shop.account.error.orderNotFound") };
  }
  if (order.userId && !order.userId.equals(user._id)) {
    return { ok: false, error: label(labels, "shop.account.error.orderClaimed") };
  }
  if (order.customer.email.trim().toLowerCase() !== user.email) {
    return { ok: false, error: label(labels, "shop.account.error.orderEmailMismatch") };
  }
  order.userId = user._id;
  await order.save();
  return { ok: true, orderNumber: order.orderNumber };
}
