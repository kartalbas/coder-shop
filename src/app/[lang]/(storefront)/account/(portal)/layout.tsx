import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AccountNav } from "@/components/storefront/account-nav";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";
import { getCustomerSessionUserId } from "@/server/session";

export default async function PortalLayout({ children, params }: LayoutProps<"/[lang]/account">) {
  await connection();
  const labels = await getLabels((await params).lang);
  // The proxy already redirects unauthenticated visitors; this is defense in depth
  // (revoked sessions pass the signature-only proxy check).
  if ((await getCustomerSessionUserId()) === null) redirect("/account/login");
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
        {label(labels, "shop.header.account")}
      </h1>
      <AccountNav />
      <div className="pt-6">{children}</div>
    </>
  );
}
