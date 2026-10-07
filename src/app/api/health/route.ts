import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const portfolios = await db.portfolio.count();
    return NextResponse.json({ ok: true, portfolios });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
