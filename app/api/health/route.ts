import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

/**
 * GET /api/health
 */
export async function GET() {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
