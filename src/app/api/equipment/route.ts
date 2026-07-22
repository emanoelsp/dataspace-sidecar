/**
 * Registro dinâmico de CPS no Sidecar PEP.
 *
 * O Dataspace registra cada CPS aqui no momento da criação do conector/ativo,
 * de modo que o sidecar conheça todos os CPS da aplicação sem lista estática.
 *
 *   GET  /api/equipment            → lista os CPS registrados (LAN)
 *   POST /api/equipment            → registra/atualiza um CPS (admin secret)
 *        { id, name, baseUrl, eclassIrdi?, connectorId?, dataOwnerId?, dataOwnerName? }
 *   PATCH /api/equipment           → habilita/desabilita: { id, status } (admin secret)
 */

import { NextRequest, NextResponse } from "next/server"
import { validateAdminSecret } from "@/lib/equipment-config"
import {
  registerEquipment,
  listEquipment,
  setEquipmentStatus,
  isValidSlug,
  type RegisterEquipmentInput,
} from "@/lib/equipment-store"

export async function GET() {
  return NextResponse.json({ equipment: listEquipment() })
}

export async function POST(request: NextRequest) {
  if (!validateAdminSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Partial<RegisterEquipmentInput>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.id || !body.name || !body.baseUrl) {
    return NextResponse.json({ error: "Required fields: id, name, baseUrl" }, { status: 400 })
  }
  if (!isValidSlug(body.id)) {
    return NextResponse.json({ error: "Invalid id: use lowercase slug (a-z, 0-9, hyphen)" }, { status: 400 })
  }
  try {
    new URL(body.baseUrl)
  } catch {
    return NextResponse.json({ error: "Invalid baseUrl" }, { status: 400 })
  }

  const equipment = registerEquipment(body as RegisterEquipmentInput)
  return NextResponse.json({ ok: true, equipment })
}

export async function PATCH(request: NextRequest) {
  if (!validateAdminSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { id?: string; status?: "active" | "disabled" }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.id || !["active", "disabled"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Required fields: id, status (active|disabled)" }, { status: 400 })
  }

  const ok = setEquipmentStatus(body.id, body.status!)
  if (!ok) return NextResponse.json({ error: `Unknown equipment: ${body.id}` }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
