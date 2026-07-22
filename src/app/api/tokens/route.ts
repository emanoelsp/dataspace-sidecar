/**
 * GET  /api/tokens        — lista todos os tokens (requer admin secret)
 * POST /api/tokens        — registra novo token (chamado pelo Dataspace após contrato aceito)
 *
 * Chamado pelo Dataspace assim que o cliente aceita a governança do ativo:
 *   POST /api/tokens
 *   Authorization: Bearer <SIDECAR_ADMIN_SECRET>
 *   Content-Type: application/json
 *   { token, federationId, federationName, assetId, assetName, equipmentType,
 *     dataOwnerId, dataOwnerName, dataClientId, dataClientName,
 *     expiresAt, governanceAcceptedAt, contractRef, permissions }
 */

import { NextRequest, NextResponse } from "next/server"
import { registerToken, listTokens, tokenStats, type RegisterTokenInput } from "@/lib/token-store"
import { validateAdminSecret } from "@/lib/equipment-config"

export async function GET(request: NextRequest) {
  if (!validateAdminSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ tokens: listTokens(), stats: tokenStats() })
}

export async function POST(request: NextRequest) {
  if (!validateAdminSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Partial<RegisterTokenInput>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const required = [
    "token", "federationId", "federationName",
    "assetId", "assetName", "equipmentType",
    "dataOwnerId", "dataOwnerName",
    "dataClientId", "dataClientName",
    "expiresAt", "governanceAcceptedAt", "contractRef", "permissions",
  ] as const

  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 })
    }
  }

  const token = registerToken(body as RegisterTokenInput)

  console.log(`[sidecar] Token registered: ${token.id} | client: ${token.dataClientName} | asset: ${token.assetName} | expires: ${token.expiresAt}`)

  return NextResponse.json({ token }, { status: 201 })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
