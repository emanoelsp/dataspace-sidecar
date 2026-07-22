/**
 * Proxy P2P — valida token e encaminha para o equipamento correto.
 *
 * Uso pelo cliente:
 *   GET /api/proxy/cnc/data       Authorization: Bearer acc_xxx
 *   GET /api/proxy/cnc/aas        Authorization: Bearer acc_xxx
 *   GET /api/proxy/press/data     Authorization: Bearer acc_xxx
 *   GET /api/proxy/robot/aas?submodel=Nameplate
 *
 * Fluxo:
 *   1. Extrai e valida o Bearer token
 *   2. Verifica se o token concede acesso ao equipamento e endpoint solicitados
 *   3. Encaminha para o equipamento com "Bearer demo"
 *   4. Loga o acesso e reporta ao Dataspace (async)
 */

import { NextRequest, NextResponse } from "next/server"
import { getTokenByValue, recordUsage } from "@/lib/token-store"
import { addEntry } from "@/lib/access-log-store"
import { getEquipmentUrl, isValidEquipment, knownEquipmentIds } from "@/lib/equipment-config"

// O sidecar vive no perímetro da fábrica; a UI do Dataspace (nuvem) apenas
// renderiza — o fetch parte do navegador dentro da LAN. CORS liberado para
// permitir esse acesso browser→sidecar; a autorização real é o Bearer token.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Expose-Headers":
    "X-Response-Time-Ms, X-Token-Id, X-Sidecar-Proxy, X-Data-Owner, X-Data-Client, X-Federation-Id, X-Contract-Ref, X-Governance-Policy",
}

function json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  })
}

async function reportToDataspace(payload: Record<string, unknown>) {
  const url = process.env.DATASPACE_WEBHOOK_URL
  const secret = process.env.DATASPACE_WEBHOOK_SECRET
  if (!url) return
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    })
  } catch { /* non-blocking */ }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const [equipment, endpoint] = path

  if (!equipment || !endpoint) {
    return json({ error: "Invalid path. Use /api/proxy/{equipment}/{endpoint}" }, { status: 400 })
  }

  if (!isValidEquipment(equipment)) {
    return json({ error: `Unknown equipment: ${equipment}`, known: knownEquipmentIds() }, { status: 404 })
  }

  if (!["data", "aas"].includes(endpoint)) {
    return json({ error: `Invalid endpoint: ${endpoint}. Use 'data' or 'aas'` }, { status: 400 })
  }

  // ── Validação do token ────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization")
  const tokenValue = authHeader?.replace(/^Bearer\s+/i, "").trim() ?? ""

  if (!tokenValue) {
    return json({
      error: "Token required",
      hint: "Authorization: Bearer <token>",
    }, { status: 401 })
  }

  const tokenDoc = getTokenByValue(tokenValue)

  if (!tokenDoc) {
    return json({ error: "Token not found" }, { status: 401 })
  }

  if (new Date(tokenDoc.expiresAt) < new Date()) {
    return json({
      error: "Token expired",
      expiredAt: tokenDoc.expiresAt,
    }, { status: 401 })
  }

  if (tokenDoc.status !== "active") {
    return json({
      error: `Token ${tokenDoc.status}`,
      tokenId: tokenDoc.id,
    }, { status: 403 })
  }

  if (tokenDoc.equipmentType !== equipment) {
    return json({
      error: "Token not authorized for this equipment",
      tokenGrantsAccess: tokenDoc.equipmentType,
      requested: equipment,
    }, { status: 403 })
  }

  const hasPermission =
    tokenDoc.permissions.includes("all") || tokenDoc.permissions.includes(endpoint)

  if (!hasPermission) {
    return json({
      error: "Insufficient permission",
      tokenPermissions: tokenDoc.permissions,
      requested: endpoint,
    }, { status: 403 })
  }

  // ── Proxy para o equipamento ──────────────────────────────────────────────
  const equipmentBase = getEquipmentUrl(equipment)!
  const qs = request.nextUrl.search
  const targetUrl = `${equipmentBase}/api/${endpoint}${qs}`

  const startMs = Date.now()
  let statusCode = 503
  let responseBody: unknown = null
  let proxyError: string | undefined

  try {
    const upstream = await fetch(targetUrl, {
      headers: { Authorization: "Bearer demo" },
      signal: AbortSignal.timeout(5000),
    })
    statusCode = upstream.status
    responseBody = await upstream.json()
  } catch (err) {
    proxyError = err instanceof Error ? err.message : String(err)
    responseBody = { error: "Equipment unreachable", equipment, targetUrl }
  }

  const responseTimeMs = Date.now() - startMs
  const success = statusCode >= 200 && statusCode < 300

  // ── Rastreabilidade ───────────────────────────────────────────────────────
  recordUsage(tokenDoc.id)

  addEntry({
    tokenId: tokenDoc.id,
    token: tokenValue,
    federationId: tokenDoc.federationId,
    assetId: tokenDoc.assetId,
    assetName: tokenDoc.assetName,
    equipmentType: equipment,
    dataClientId: tokenDoc.dataClientId,
    dataClientName: tokenDoc.dataClientName,
    dataOwnerId: tokenDoc.dataOwnerId,
    dataOwnerName: tokenDoc.dataOwnerName,
    contractRef: tokenDoc.contractRef,
    governancePolicyId: tokenDoc.governance?.policyId,
    endpoint,
    method: "GET",
    statusCode,
    responseTimeMs,
    success,
    error: proxyError,
  })

  // Notify the Dataspace asynchronously (non-blocking)
  reportToDataspace({
    event: "proxy_access",
    timestamp: new Date().toISOString(),
    tokenId: tokenDoc.id,
    contractRef: tokenDoc.contractRef,
    federationId: tokenDoc.federationId,
    assetId: tokenDoc.assetId,
    assetName: tokenDoc.assetName,
    equipmentType: equipment,
    endpoint,
    method: "GET",
    dataClientId: tokenDoc.dataClientId,
    dataClientName: tokenDoc.dataClientName,
    dataOwnerId: tokenDoc.dataOwnerId,
    dataOwnerName: tokenDoc.dataOwnerName,
    statusCode,
    responseTimeMs,
    success,
    error: proxyError,
    governance: tokenDoc.governance ?? null,
  })

  if (!success) {
    return json(responseBody, {
      status: statusCode === 503 ? 503 : statusCode,
      headers: { "X-Sidecar-Proxy": "true", "X-Token-Id": tokenDoc.id },
    })
  }

  return json(responseBody, {
    headers: {
      "X-Sidecar-Proxy": "true",
      "X-Token-Id": tokenDoc.id,
      "X-Data-Owner": tokenDoc.dataOwnerId,
      "X-Data-Client": tokenDoc.dataClientId,
      "X-Federation-Id": tokenDoc.federationId,
      "X-Contract-Ref": tokenDoc.contractRef,
      ...(tokenDoc.governance?.policyId ? { "X-Governance-Policy": tokenDoc.governance.policyId } : {}),
      "X-Response-Time-Ms": String(responseTimeMs),
      "Cache-Control": "no-store",
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
