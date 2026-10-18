import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerLogoutAction } from "@/server/actions/account";

// Issue #58 step 3: the button text is a translation-table text handed in by the page.
export function AccountLogoutButton({ label }: { label: string }) {
  return (
    <form action={customerLogoutAction}>
      <Button type="submit" variant="outline" size="sm" className="gap-2">
        <LogOut className="size-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}
