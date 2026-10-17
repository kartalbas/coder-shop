import { connection, NextResponse } from "next/server";
import { connectDB, dbMode } from "@/server/db";

export async function GET(): Promise<NextResponse> {
  try {
    await connection();
    await connectDB();
    return NextResponse.json({ ok: true, db: dbMode() });
  } catch (error) {
    console.error("health check: database unavailable:", error);
    return NextResponse.json(
      { ok: false, db: dbMode(), error: "Datenbank nicht erreichbar." },
      { status: 500 },
    );
  }
}
