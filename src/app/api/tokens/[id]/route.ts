/**
 * GET   /api/tokens/:id  — detalhes do token
 * PATCH /api/tokens/:id  — revogar token  { "action": "revoke" }
 */

import { NextRequest, NextResponse } from "next/server"
import { getTokenById, revokeToken } from "@/lib/token-store"
import { validateAdminSecret } from "@/lib/equipment-config"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateAdminSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const token = getTokenById(id)
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 404 })
  return NextResponse.json({ token })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateAdminSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json().catch(() => ({})) as { action?: string }

  if (body.action !== "revoke") {
    return NextResponse.json({ error: 'Expected { "action": "revoke" }' }, { status: 400 })
  }

  const ok = revokeToken(id)
  if (!ok) return NextResponse.json({ error: "Token not found" }, { status: 404 })

  console.log(`[sidecar] Token revogado: ${id}`)
  return NextResponse.json({ message: "Token revoked", id })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
