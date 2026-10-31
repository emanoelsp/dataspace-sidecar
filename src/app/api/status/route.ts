import { NextRequest, NextResponse } from "next/server"
import { tokenStats, expiredNotRenewedCount } from "@/lib/token-store"
import { logStats } from "@/lib/access-log-store"
import { listEquipment, equipmentStats } from "@/lib/equipment-store"

export async function GET(_request: NextRequest) {
  const all = listEquipment() // all registered equipment, regardless of status

  const equipmentChecks = await Promise.all(
    all.map(async (e) => {
      // Disabled equipment shows as "offline" without a live probe
      if (e.status === "disabled") {
        return {
          type: e.id,
          name: e.name,
          url: e.displayHost ?? e.baseUrl,
          source: e.source,
          registered: true,
          status: "offline" as const,
          responseTimeMs: 0,
        }
      }
      const start = Date.now()
      const probe = (path: string) => fetch(`${e.baseUrl}${path}`, {
        headers: { Authorization: "Bearer demo" },
        signal: AbortSignal.timeout(2500),
      })
      try {
        let res = await probe("/api/data")
        // CPS que só expõe recursos próprios (sem /api/data): sonda o primeiro recurso
        if (res.status === 404 && e.resources?.length) res = await probe(e.resources[0].path)
        return {
          type: e.id,
          name: e.name,
          url: e.displayHost ?? e.baseUrl,
          source: e.source,
          registered: true,
          status: res.ok ? "online" as const : "error" as const,
          httpStatus: res.status,
          responseTimeMs: Date.now() - start,
        }
      } catch {
        return {
          type: e.id,
          name: e.name,
          url: e.displayHost ?? e.baseUrl,
          source: e.source,
          registered: true,
          status: "offline" as const,
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
