import { NextRequest, NextResponse } from "next/server"
import { tokenStats, expiredNotRenewedCount } from "@/lib/token-store"
import { logStats } from "@/lib/access-log-store"
import { listEquipment, equipmentStats } from "@/lib/equipment-store"

export async function GET(_request: NextRequest) {
  const equipmentChecks = await Promise.all(
    listEquipment().filter(e => e.status === "active").map(async (e) => {
      const start = Date.now()
      try {
        const res = await fetch(`${e.baseUrl}/api/data`, {
          headers: { Authorization: "Bearer demo" },
          signal: AbortSignal.timeout(2500),
        })
        return {
          type: e.id,
          name: e.name,
          url: e.baseUrl,
          source: e.source,
          status: res.ok ? "online" : "error",
          httpStatus: res.status,
          responseTimeMs: Date.now() - start,
        }
      } catch {
        return {
          type: e.id,
          name: e.name,
          url: e.baseUrl,
          source: e.source,
          status: "offline",
          responseTimeMs: Date.now() - start,
        }
      }
    }),
  )

  return NextResponse.json({
    sidecar: "online",
    timestamp: new Date().toISOString(),
    version: "1.1.0",
    equipment: equipmentChecks,
    registry: equipmentStats(),
    tokens: { ...tokenStats(), expiredNotRenewed: expiredNotRenewedCount() },
    access: logStats(),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
