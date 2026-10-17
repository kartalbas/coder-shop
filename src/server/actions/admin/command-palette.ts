"use server";

import { z } from "zod";
import { commandSearchCore, type PaletteHit } from "@/server/command-palette";
import { requireAdminSession } from "@/server/session";

const querySchema = z.string().trim().max(100);

// Command palette search (issue #49) — same boundary rule as the picker searches:
// called from the client with arbitrary values, junk means "no search", never a 500.
export async function commandSearchAction(query: unknown): Promise<PaletteHit[]> {
  await requireAdminSession();
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return [];
  return commandSearchCore(parsed.data);
}
