// Compatibilidade: o cadastro de equipamentos agora é dinâmico (equipment-store).
// O sidecar conhece os CPS registrados pelo Dataspace no momento da criação do
// conector/ativo, com seed dos 3 equipamentos legados via variáveis de ambiente.

import { getEquipment, listEquipment } from "@/lib/equipment-store"

export function getEquipmentUrl(id: string): string | undefined {
  const e = getEquipment(id)
  return e && e.status === "active" ? e.baseUrl : undefined
}

export function getEquipmentDisplayHost(id: string): string | undefined {
  return getEquipment(id)?.displayHost
}

export function getEquipmentName(id: string): string | undefined {
  return getEquipment(id)?.name
}

export function isValidEquipment(id: string): boolean {
  const e = getEquipment(id)
  return Boolean(e && e.status === "active")
}

export function knownEquipmentIds(): string[] {
  return listEquipment().filter(e => e.status === "active").map(e => e.id)
}

export function validateAdminSecret(header: string | null): boolean {
  if (!header) return false
  const secret = header.replace(/^Bearer\s+/i, "").trim()
  const env = process.env.SIDECAR_ADMIN_SECRET ?? "admin"
  return secret === env
}
