import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AccountNav } from "@/components/storefront/account-nav";
import { getCustomerSessionUserId } from "@/server/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await connection();
  // The proxy already redirects unauthenticated visitors; this is defense in depth
  // (revoked sessions pass the signature-only proxy check).
  if ((await getCustomerSessionUserId()) === null) redirect("/account/login");
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">Mein Konto</h1>
      <AccountNav />
      <div className="pt-6">{children}</div>
    </>
  );
}
