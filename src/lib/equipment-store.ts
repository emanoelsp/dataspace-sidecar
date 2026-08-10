import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), ".data")
const EQUIPMENT_FILE = path.join(DATA_DIR, "equipment.json")

export interface SidecarEquipment {
  id: string              // slug único: "cnc", "press", "robot", "agv01"...
  name: string
  baseUrl: string         // app do CPS que expõe /api/data e /api/aas
  displayHost?: string    // IP/host exibido na LAN (mascaramento); o proxy usa baseUrl
  eclassIrdi?: string     // classe ECLASS do equipamento
  connectorId?: string    // conector do dataspace que registrou o CPS
  dataOwnerId?: string
  dataOwnerName?: string
  source: "env" | "dataspace"
  status: "active" | "disabled"
  registeredAt: string
  updatedAt: string
}

export type RegisterEquipmentInput = {
  id: string
  name: string
  baseUrl: string
  displayHost?: string
  eclassIrdi?: string
  connectorId?: string
  dataOwnerId?: string
  dataOwnerName?: string
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function persist(store: Map<string, SidecarEquipment>) {
  ensureDataDir()
  fs.writeFileSync(EQUIPMENT_FILE, JSON.stringify(Object.fromEntries(store), null, 2), "utf-8")
}

// Seed apenas do que estiver EXPLICITAMENTE configurado no ambiente.
// Um sidecar recém-instalado em outra organização inicia vazio: os CPS
// chegam exclusivamente via registro do Dataspace (multi-tenant seguro).
function seedFromEnv(): Map<string, SidecarEquipment> {
  const now = new Date().toISOString()
  const defs: Array<[string, string, string | undefined, string]> = [
    ["cnc",   "CNC Machining Center", process.env.EQUIPMENT_CNC_URL,   "27-01-02-16"],
    ["press", "Hydraulic Press",      process.env.EQUIPMENT_PRESS_URL, "27-01-05-01"],
    ["robot", "Industrial Robot",     process.env.EQUIPMENT_ROBOT_URL, "27-01-04-01"],
  ]
  return new Map(defs
    .filter((d): d is [string, string, string, string] => Boolean(d[2]))
    .map(([id, name, baseUrl, eclassIrdi]) => [id, {
      id, name, baseUrl, eclassIrdi,
      source: "env" as const, status: "active" as const,
      registeredAt: now, updatedAt: now,
    }]))
}

function hydrate(): Map<string, SidecarEquipment> {
  try {
    ensureDataDir()
    if (fs.existsSync(EQUIPMENT_FILE)) {
      return new Map(Object.entries(JSON.parse(fs.readFileSync(EQUIPMENT_FILE, "utf-8"))))
    }
  } catch { /* start fresh */ }
  const seeded = seedFromEnv()
  persist(seeded)
  return seeded
}

let store: Map<string, SidecarEquipment> = hydrate()

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export function isValidSlug(id: string): boolean {
  return SLUG_RE.test(id)
}

/** Upsert por id — registro vindo do Dataspace sobrescreve URL/nome/dono. */
export function registerEquipment(input: RegisterEquipmentInput): SidecarEquipment {
  const now = new Date().toISOString()
  const existing = store.get(input.id)
  const equipment: SidecarEquipment = {
    ...existing,
    ...input,
    source: "dataspace",
    status: "active",
    registeredAt: existing?.registeredAt ?? now,
    updatedAt: now,
  }
  store.set(equipment.id, equipment)
  persist(store)
  return equipment
}

export function listEquipment(): SidecarEquipment[] {
  return Array.from(store.values()).sort((a, b) => a.id.localeCompare(b.id))
}

export function getEquipment(id: string): SidecarEquipment | undefined {
  return store.get(id)
}

export function setEquipmentStatus(id: string, status: "active" | "disabled"): boolean {
  const e = store.get(id)
  if (!e) return false
  store.set(id, { ...e, status, updatedAt: new Date().toISOString() })
  persist(store)
  return true
}

export function equipmentStats() {
  const all = Array.from(store.values())
  return {
    total: all.length,
    active: all.filter(e => e.status === "active").length,
    fromDataspace: all.filter(e => e.source === "dataspace").length,
  }
}
