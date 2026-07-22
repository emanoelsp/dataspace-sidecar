import { NextRequest, NextResponse } from "next/server"
import { getLog, logStats } from "@/lib/access-log-store"
import { validateAdminSecret } from "@/lib/equipment-config"

export async function GET(request: NextRequest) {
  if (!validateAdminSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50")
  return NextResponse.json({ entries: getLog(limit), stats: logStats() })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
