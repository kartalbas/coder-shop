import type { Metadata } from "next";
import { connection } from "next/server";
import { label } from "@/lib/i18n";
import { getLabels } from "@/server/i18n";

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]/account">): Promise<Metadata> {
  await connection();
  const labels = await getLabels((await params).lang);
  return {
    title: label(labels, "shop.meta.account.title"),
    description: label(labels, "shop.meta.account.description"),
    robots: { index: false },
  };
}

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>;
}
