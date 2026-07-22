import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), ".data")
const LOG_FILE = path.join(DATA_DIR, "access-log.json")
const MAX_ENTRIES = 1000

export interface AccessLogEntry {
  id: string
  timestamp: string
  tokenId: string
  token: string           // primeiros 12 chars apenas (mascarado)
  federationId: string
  assetId: string
  assetName: string
  equipmentType: string
  dataClientId: string
  dataClientName: string
  dataOwnerId: string
  dataOwnerName: string
  contractRef?: string
  governancePolicyId?: string
  endpoint: string        // "data" | "aas"
  method: string
  statusCode: number
  responseTimeMs: number
  success: boolean
  error?: string
}

export type NewLogEntry = Omit<AccessLogEntry, "id" | "timestamp">

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function load(): AccessLogEntry[] {
  try {
    ensureDataDir()
    if (fs.existsSync(LOG_FILE)) return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"))
  } catch { /* start fresh */ }
  return []
}

function persist(entries: AccessLogEntry[]) {
  ensureDataDir()
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries.slice(-MAX_ENTRIES), null, 2), "utf-8")
}

let log: AccessLogEntry[] = load()

export function addEntry(entry: NewLogEntry): AccessLogEntry {
  const newEntry: AccessLogEntry = {
    ...entry,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    token: entry.token.slice(0, 12) + "…",
  }
  log = [...log.slice(-(MAX_ENTRIES - 1)), newEntry]
  persist(log)
  return newEntry
}

export function getLog(limit = 100): AccessLogEntry[] {
  return [...log].reverse().slice(0, limit)
}

export function logStats() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = log.filter(e => new Date(e.timestamp) > cutoff)
  return {
    total: log.length,
    last24h: recent.length,
    successful: recent.filter(e => e.success).length,
    failed: recent.filter(e => !e.success).length,
    byEquipment: {
      cnc: recent.filter(e => e.equipmentType === "cnc").length,
      press: recent.filter(e => e.equipmentType === "press").length,
      robot: recent.filter(e => e.equipmentType === "robot").length,
    },
    avgResponseMs: recent.length
      ? Math.round(recent.reduce((s, e) => s + e.responseTimeMs, 0) / recent.length)
      : 0,
  }
}
