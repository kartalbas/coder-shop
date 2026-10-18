export const instant = false;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { LabelButton, PrintButton } from "@/components/admin/label-actions";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { PackList } from "@/components/admin/pack-list";
import { interpolate, label, splitOnPlaceholder } from "@/lib/i18n";
import { getOrderById } from "@/server/orders-admin";
import { getRequestLabels } from "@/server/i18n";

interface PagePropsLocal {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PagePropsLocal): Promise<Metadata> {
  await connection();
  const [{ id }, labels] = await Promise.all([params, getRequestLabels()]);
  return {
    title: interpolate(label(labels, "admin.packing.slipHeading"), { number: id }),
    description: label(labels, "admin.meta.packingSlip.description"),
  };
}

async function PackingDetail({ params }: PagePropsLocal) {
  await connection();
  const { id } = await params;
  const [order, labels] = await Promise.all([getOrderById(id), getRequestLabels()]);
  if (!order) notFound();
  if (order.status !== "picking" && order.status !== "packed") notFound();

  const labelNote = splitOnPlaceholder(label(labels, "admin.packing.labelNote"), "link");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print">
        <Link
          href="/admin/packing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {label(labels, "admin.packing.back")}
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {interpolate(label(labels, "admin.packing.slipHeading"), { number: order.orderNumber })}
          </h1>
          <OrderStatusBadge status={order.status} labels={labels} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrintButton />
          {order.status === "packed" ? (
            <LabelButton orderId={order._id.toString()} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {labelNote.before}
              <Link
                href={`/admin/orders/${order._id.toString()}`}
                className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label(labels, "admin.packing.openOrder")}
              </Link>
              {labelNote.after}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <PackList order={order} labels={labels} />
      </div>
    </div>
  );
}

export default function PackingDetailPage({ params }: PagePropsLocal) {
  return <PackingDetail params={params} />;
}
