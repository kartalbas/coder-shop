import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customerLogoutAction } from "@/server/actions/account";

export function AccountLogoutButton() {
  return (
    <form action={customerLogoutAction}>
      <Button type="submit" variant="outline" size="sm" className="gap-2">
        <LogOut className="size-4" aria-hidden />
        Abmelden
      </Button>
    </form>
  );
}
