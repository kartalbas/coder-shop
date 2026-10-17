import { connection, NextResponse } from "next/server";
import { connectDB, dbMode } from "@/server/db";

export async function GET(): Promise<NextResponse> {
  try {
    await connection();
    await connectDB();
    return NextResponse.json({ ok: true, db: dbMode() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, db: dbMode(), error: message }, { status: 500 });
  }
}
