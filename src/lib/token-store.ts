import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), ".data")
const TOKENS_FILE = path.join(DATA_DIR, "tokens.json")

export interface TokenGovernance {
  policyId?: string
  accessTokenTtlMinutes?: number
  purposeBinding?: boolean
  requiresManualApproval?: boolean
  revocationMode?: string
  conditions?: string
}

export interface SidecarToken {
  id: string
  token: string           // valor Bearer apresentado pelo cliente
  federationId: string
  federationName: string
  assetId: string
  assetName: string
  equipmentType: string   // "cnc" | "press" | "robot"
  dataOwnerId: string     // connector ID do dono dos dados
  dataOwnerName: string
  dataClientId: string    // connector ID do cliente dos dados
  dataClientName: string
  issuedAt: string
  expiresAt: string
  governanceAcceptedAt: string
  contractRef: string     // referência do contrato no dataspace
  status: "active" | "revoked" | "expired"
  permissions: string[]   // ["data", "aas"] ou ["all"]
  governance?: TokenGovernance // determinações herdadas da política do ativo
  usageCount: number
  lastUsedAt?: string
}

export type RegisterTokenInput = Omit<SidecarToken, "id" | "issuedAt" | "status" | "usageCount">

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function persist(store: Map<string, SidecarToken>) {
  ensureDataDir()
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(Object.fromEntries(store), null, 2), "utf-8")
}

function hydrate(): Map<string, SidecarToken> {
  try {
    ensureDataDir()
    if (fs.existsSync(TOKENS_FILE)) {
      return new Map(Object.entries(JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"))))
    }
  } catch { /* start fresh */ }
  return new Map()
}

// Module-level store — persiste enquanto o processo Node.js estiver rodando
let store: Map<string, SidecarToken> = hydrate()

function checkExpiry() {
  const now = new Date()
  let changed = false
  Array.from(store.entries()).forEach(([id, t]) => {
    if (t.status === "active" && new Date(t.expiresAt) < now) {
      store.set(id, { ...t, status: "expired" })
      changed = true
    }
  })
  if (changed) persist(store)
}

export function registerToken(input: RegisterTokenInput): SidecarToken {
  checkExpiry()
  const token: SidecarToken = {
    ...input,
    id: randomUUID(),
    issuedAt: new Date().toISOString(),
    status: "active",
    usageCount: 0,
  }
  store.set(token.id, token)
  persist(store)
  return token
}

export function listTokens(): SidecarToken[] {
  checkExpiry()
  return Array.from(store.values()).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
}

export function getTokenById(id: string): SidecarToken | undefined {
  checkExpiry()
  return store.get(id)
}

export function getTokenByValue(tokenValue: string): SidecarToken | undefined {
  checkExpiry()
  return Array.from(store.values()).find(t => t.token === tokenValue)
}

export function revokeToken(id: string): boolean {
  const t = store.get(id)
  if (!t) return false
  store.set(id, { ...t, status: "revoked" })
  persist(store)
  return true
}

export function recordUsage(id: string) {
  const t = store.get(id)
  if (t) {
    store.set(id, { ...t, usageCount: t.usageCount + 1, lastUsedAt: new Date().toISOString() })
    persist(store)
  }
}

export function tokenStats() {
  checkExpiry()
  const all = Array.from(store.values())
  return {
    total: all.length,
    active: all.filter(t => t.status === "active").length,
    expired: all.filter(t => t.status === "expired").length,
    revoked: all.filter(t => t.status === "revoked").length,
  }
}

export function expiredNotRenewedCount(): number {
  checkExpiry()
  const all = Array.from(store.values())
  return all
    .filter(t => t.status === "expired")
    .filter(exp =>
      !all.some(
        a =>
          a.dataClientId === exp.dataClientId &&
          a.assetId === exp.assetId &&
          a.status === "active" &&
          new Date(a.issuedAt) > new Date(exp.issuedAt)
      )
    ).length
}
