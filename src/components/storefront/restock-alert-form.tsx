"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeRestockAlertAction } from "@/server/actions/restock-alerts";

// "Benachrichtigen, wenn wieder verfügbar" for a sold-out variant (issue #46). The
// address is remembered locally so the form does not reappear after a subscription.
export function RestockAlertForm({ sku, productName }: { sku: string; productName: string }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await subscribeRestockAlertAction(sku, email);
      if (!result.ok) {
        toast.error(result.error ?? "Die Anmeldung hat nicht funktioniert.");
        return;
      }
      setSubscribed(true);
      toast.success(
        result.inStock
          ? "Der Artikel ist wieder an Lager — viel Freude damit."
          : "Wir geben Bescheid, sobald der Artikel wieder an Lager ist.",
      );
    });
  };

  if (subscribed) {
    return (
      <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm" role="status">
        <Bell className="mr-1.5 inline size-4 text-primary" aria-hidden />
        Benachrichtigung für {email} ist vorgemerkt.
      </p>
    );
  }

  return (
    <form
      className="space-y-2 rounded-md border bg-muted/30 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="text-sm font-medium">Benachrichtigen, wenn wieder verfügbar</p>
      <div className="flex gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ihre@email.ch"
          aria-label={`E-Mail für Benachrichtigung zu ${productName}`}
          autoComplete="email"
          className="h-9"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bell className="size-4" aria-hidden />}
          Benachrichtigen
        </Button>
      </div>
    </form>
  );
}
