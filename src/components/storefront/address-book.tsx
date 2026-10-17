"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  deleteAddressAction,
  saveAddressAction,
  type AccountActionState,
} from "@/server/actions/account";

export interface AddressEntry {
  id: string;
  label: string;
  street: string;
  postalCode: string;
  city: string;
  kind: "shipping" | "billing";
  isDefault: boolean;
}

function AddressForm({ entry, onDone }: { entry: AddressEntry | null; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<AccountActionState | null, FormData>(
    saveAddressAction,
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(state.message ?? "Adresse gespeichert.");
      onDone();
    }
  }, [state, onDone]);

  const editing = entry !== null;

  return (
    <form action={formAction} className="space-y-4">
      {editing && <input type="hidden" name="addressId" value={entry.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="label">Bezeichnung</Label>
          <Input
            id="label"
            name="label"
            defaultValue={editing ? entry.label : ""}
            placeholder="z. B. Zuhause, Büro"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="street">Strasse, Hausnummer</Label>
          <Input
            id="street"
            name="street"
            defaultValue={editing ? entry.street : ""}
            autoComplete="street-address"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postalCode">PLZ</Label>
          <Input
            id="postalCode"
            name="postalCode"
            defaultValue={editing ? entry.postalCode : ""}
            inputMode="numeric"
            pattern="\d{4}"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ort</Label>
          <Input
            id="city"
            name="city"
            defaultValue={editing ? entry.city : ""}
            autoComplete="address-level2"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kind">Art</Label>
          <select
            id="kind"
            name="kind"
            defaultValue={editing ? entry.kind : "shipping"}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="shipping">Lieferadresse</option>
            <option value="billing">Rechnungsadresse</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-7">
          <input
            id="isDefault"
            name="isDefault"
            type="checkbox"
            defaultChecked={editing ? entry.isDefault : false}
            className="size-4 accent-primary"
          />
          <Label htmlFor="isDefault" className="font-normal">
            Als Standard setzen
          </Label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Speichern
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: AddressEntry[] }) {
  const [draft, setDraft] = useState<AddressEntry | null | undefined>(undefined);

  const start = (entry: AddressEntry | null) => {
    setDraft(entry);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      {draft !== undefined ? (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-semibold">
              {draft === null ? "Neue Adresse" : "Adresse bearbeiten"}
            </h2>
            <AddressForm entry={draft} onDone={() => setDraft(undefined)} />
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => start(null)} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Neue Adresse
        </Button>
      )}

      {addresses.length === 0 && draft === undefined ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Adressen gespeichert. In der Kasse können Sie eine Adresse auswählen.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    {address.label}
                    {address.isDefault && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary",
                        )}
                      >
                        <Star className="size-3" aria-hidden />
                        Standard
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {address.street}
                    <br />
                    {address.postalCode} {address.city} · CH
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {address.kind === "billing" ? "Rechnungsadresse" : "Lieferadresse"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Adresse „${address.label}“ bearbeiten`}
                    onClick={() => start(address)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="addressId" value={address.id} />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Adresse „${address.label}“ löschen`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
