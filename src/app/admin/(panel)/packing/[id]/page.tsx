export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { LabelButton, PrintButton } from "@/components/admin/label-actions";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { PackList } from "@/components/admin/pack-list";
import { getOrderById } from "@/server/orders-admin";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  const { id } = await params;
  return { title: `Packzettel ${id}`, description: "Pickliste und Packzettel zum Drucken." };
}

async function PackingDetail({ params }: PagePropsLocal) {
  await connection();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();
  if (order.status !== "picking" && order.status !== "packed") notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print">
        <Link
          href="/admin/packing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Zurück zur Queue
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Packzettel {order.orderNumber}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrintButton />
          {order.status === "packed" ? (
            <LabelButton orderId={order._id.toString()} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Etikett erstellbar, sobald die Bestellung als verpackt markiert ist (Bestellung{" "}
              <Link
                href={`/admin/orders/${order._id.toString()}`}
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                öffnen
              </Link>
              ).
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <PackList order={order} />
      </div>
    </div>
  );
}

export default function PackingDetailPage({ params }: PagePropsLocal) {
  return <PackingDetail params={params} />;
}
