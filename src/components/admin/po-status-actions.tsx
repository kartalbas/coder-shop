"use client";

import { useEffect, useRef, useActionState } from "react";
import { Loader2, PackageCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { useLabels } from "@/components/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { interpolate, label } from "@/lib/i18n";
import {
  markPurchaseOrderOrderedAction,
  receivePurchaseOrderAction,
  setExpectedArrivalAction,
  type PurchasingActionState,
} from "@/server/actions/admin/purchasing";

type ReceiveState = PurchasingActionState & { summary?: string; complete?: boolean };

export function MarkOrderedButton({ poId }: { poId: string }) {
  const labels = useLabels();
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [state, formAction, pending] = useActionState<PurchasingActionState | null, FormData>(
    markPurchaseOrderOrderedAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(label(labelsRef.current, "admin.po.markOrderedToast"));
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="poId" value={poId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        <Send className="size-4" aria-hidden />
        {label(labels, "admin.po.markOrdered")}
      </Button>
    </form>
  );
}

export interface ReceiveLine {
  sku: string;
  open: number;
  // Issue #62 (#54): serial-tracked lines register each piece by serial number.
  serial: boolean;
}

// Issue #62 (#55): goods receipt per line — every line defaults to the still open
// quantity; lowering one of them receives partially and the rest stays "on order".
// Serial-tracked lines additionally take one serial number per line of input.
export function ReceiveForm({ poId, lines }: { poId: string; lines: ReceiveLine[] }) {
  const labels = useLabels();
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [state, formAction, pending] = useActionState<ReceiveState | null, FormData>(
    receivePurchaseOrderAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      const summary = state.summary ? `: ${state.summary}` : "";
      toast.success(
        state.complete
          ? interpolate(label(labelsRef.current, "admin.po.receivedToast"), { summary })
          : interpolate(label(labelsRef.current, "admin.po.receivedPartialToast"), {
              summary,
            }),
      );
    }
  }, [state]);

  const handleSubmit = (formData: FormData) => {
    const quantities: Record<string, number> = {};
    const serials: Record<string, string[]> = {};
    for (const line of lines) {
      quantities[line.sku] = Number(formData.get(`qty-${line.sku}`) ?? 0);
      if (line.serial) {
        const raw = String(formData.get(`serials-${line.sku}`) ?? "");
        serials[line.sku] = raw
          .split("\n")
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
      }
    }
    formData.set("quantities", JSON.stringify(quantities));
    if (Object.keys(serials).length > 0) formData.set("serials", JSON.stringify(serials));
    return formAction(formData);
  };

  return (
    <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="poId" value={poId} />
      {lines.map((line) => (
        <div key={line.sku} className="space-y-1">
          <label className="block space-y-1 text-xs text-muted-foreground">
            {interpolate(label(labels, "admin.po.receivedQty"), { sku: line.sku })}
            <Input
              name={`qty-${line.sku}`}
              type="number"
              min={0}
              max={line.open}
              defaultValue={line.open}
              className="h-8 w-24 text-sm"
              aria-label={interpolate(label(labels, "admin.po.receivedQtyAria"), {
                sku: line.sku,
              })}
            />
          </label>
          {line.serial && (
            <label className="block space-y-1 text-xs text-muted-foreground">
              {interpolate(label(labels, "admin.po.serials"), { sku: line.sku })}
              <textarea
                name={`serials-${line.sku}`}
                rows={Math.min(6, Math.max(2, line.open))}
                defaultValue={""}
                placeholder={label(labels, "admin.po.serialsPlaceholder")}
                className="w-56 rounded-md border bg-background p-2 font-mono text-xs focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={interpolate(label(labels, "admin.po.serialsAria"), {
                  sku: line.sku,
                })}
              />
            </label>
          )}
        </div>
      ))}
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        <PackageCheck className="size-4" aria-hidden />
        {label(labels, "admin.po.receive")}
      </Button>
    </form>
  );
}

// Issue #62 (#55): the expected arrival (from the supplier lead time) is editable per PO.
export function ExpectedArrivalForm({
  poId,
  defaultValue,
}: {
  poId: string;
  defaultValue: string;
}) {
  const labels = useLabels();
  const labelsRef = useRef(labels);
  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);
  const [state, formAction, pending] = useActionState<PurchasingActionState | null, FormData>(
    setExpectedArrivalAction,
    null,
  );
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(label(labelsRef.current, "admin.po.expectedArrivalToast"));
  }, [state]);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="poId" value={poId} />
      <label className="space-y-1 text-xs text-muted-foreground">
        {label(labels, "admin.po.expectedArrival")}
        <Input
          name="arrival"
          type="date"
          defaultValue={defaultValue}
          className="h-8 text-sm"
          aria-label={label(labels, "admin.po.expectedArrival")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label(labels, "admin.action.save")}
      </Button>
    </form>
  );
}
