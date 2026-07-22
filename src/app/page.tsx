"use client"

import { useState, useEffect, useCallback } from "react"
import type { SidecarToken } from "@/lib/token-store"
import type { AccessLogEntry } from "@/lib/access-log-store"

const ADMIN = "admin" // corresponde a SIDECAR_ADMIN_SECRET padrão

interface EquipmentStatus {
  type: string; name: string; url: string
  status: "online" | "offline" | "error"; responseTimeMs: number; httpStatus?: number
}

interface Status {
  sidecar: string; timestamp: string
  equipment: EquipmentStatus[]
  tokens: { total: number; active: number; expired: number; revoked: number; expiredNotRenewed: number }
  access: { total: number; last24h: number; successful: number; failed: number; avgResponseMs: number; byEquipment: Record<string, number> }
}

const STATUS_COLOR: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-900/30 border-emerald-700",
  expired: "text-amber-400 bg-amber-900/30 border-amber-700",
  revoked: "text-red-400 bg-red-900/30 border-red-700",
}

const EQ_ICON: Record<string, string> = { cnc: "⚙️", press: "🔩", robot: "🦾" }

const EQUIPMENT_URL_LABELS: Record<string, string> = {
  cnc: "192.168.0.70:3001",
  press: "192.168.0.168:3002",
  robot: "localhost:3003",
}

function EquipmentNode({ eq, type }: { eq: EquipmentStatus | undefined; type: string }) {
  const s = eq?.status ?? "offline"
  const url = eq?.url ? eq.url.replace(/^https?:\/\//, "") : EQUIPMENT_URL_LABELS[type]
  return (
    <div className={`rounded-xl p-3 border flex flex-col gap-2 ${s === "online" ? "bg-emerald-900/20 border-emerald-700" : "bg-slate-800/60 border-slate-700"}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">{EQ_ICON[type] ?? "📦"}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{eq?.name ?? type.toUpperCase()}</p>
          <span className={`text-xs font-bold ${s === "online" ? "text-emerald-400" : s === "error" ? "text-amber-400" : "text-red-400"}`}>
            ● {s}
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-slate-950/60 px-2 py-1">
        <p className="text-xs font-mono text-slate-300 break-all">{url}</p>
      </div>
      {eq && <p className="text-xs text-slate-600 text-right">{eq.responseTimeMs} ms</p>}
    </div>
  )
}

function TopologySection({ equipment }: { equipment: EquipmentStatus[] }) {
  const byType = (t: string) => equipment.find(e => e.type === t)
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-6">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-4 font-semibold">
        Network Topology — Control Plane · Data Plane
      </p>

      {/* ── Cloud zone ── */}
      <div className="rounded-xl border border-sky-800/60 bg-sky-950/25 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span>☁️</span>
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Cloud — Control Plane</span>
        </div>
        <div className="flex items-center gap-3 bg-sky-900/20 border border-sky-800/40 rounded-xl px-4 py-3">
          <span className="text-2xl">🗄️</span>
          <div>
            <p className="text-sm font-bold text-white">INTRA Dataspace</p>
            <p className="text-xs font-mono text-sky-300">dataspace-v2.vercel.app</p>
          </div>
          <div className="ml-auto text-right text-xs text-sky-700 leading-relaxed">
            Contract negotiation<br />Token issuance · Governance
          </div>
        </div>
      </div>

      {/* ── Connector arrow ── */}
      <div className="flex flex-col items-center py-3 select-none">
        <div className="h-3 w-px bg-indigo-800" />
        <div className="flex items-center gap-2 my-1">
          <div className="h-px w-10 bg-indigo-800" />
          <span className="text-xs font-mono text-indigo-500 whitespace-nowrap">POST /api/tokens · 5-min TTL</span>
          <div className="h-px w-10 bg-indigo-800" />
        </div>
        <div className="h-3 w-px bg-indigo-800" />
        <span className="text-indigo-500 text-sm">▼</span>
      </div>

      {/* ── Factory zone ── */}
      <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span>🏭</span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Factory Perimeter — Fog Tier · Data Plane</span>
          </div>
          <span className="text-xs font-mono text-emerald-800">LAN · 192.168.0.x</span>
        </div>

        {/* Three-node flow: CNC ←― Sidecar ―← Press */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
          {/* CNC */}
          <EquipmentNode eq={byType("cnc")} type="cnc" />

          {/* Arrow CNC ← Sidecar */}
          <div className="flex flex-col items-center gap-1 px-1 text-slate-600 text-xs select-none">
            <span className="font-mono text-emerald-700 text-xs">data ◄</span>
            <div className="h-px w-8 bg-emerald-900" />
            <span className="font-mono text-slate-700 text-xs">proxy</span>
          </div>

          {/* Sidecar PEP */}
          <div className="rounded-xl border border-indigo-700 bg-indigo-900/30 p-3 flex flex-col items-center gap-1 text-center">
            <span className="text-2xl">🔀</span>
            <p className="text-xs font-bold text-indigo-300">Sidecar PEP</p>
            <p className="text-xs font-mono text-indigo-500">localhost:3100</p>
            <p className="text-xs text-indigo-700 leading-snug">Token validation<br />at the edge</p>
          </div>

          {/* Arrow Sidecar ← Press */}
          <div className="flex flex-col items-center gap-1 px-1 text-slate-600 text-xs select-none">
            <span className="font-mono text-sky-700 text-xs">Bearer ◄</span>
            <div className="h-px w-8 bg-sky-900" />
            <span className="font-mono text-slate-700 text-xs">token</span>
          </div>

          {/* Press */}
          <EquipmentNode eq={byType("press")} type="press" />
        </div>

        <p className="text-center text-xs text-emerald-900 mt-4">
          Data flows P2P within factory LAN — never leaves the perimeter · Token verified locally by Sidecar
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? "bg-indigo-900/30 border-indigo-700" : "bg-slate-800 border-slate-700"}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold font-mono ${accent ? "text-indigo-300" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function TokenRow({ token, onRevoke }: { token: SidecarToken; onRevoke: (id: string) => void }) {
  const expires = new Date(token.expiresAt)
  const now = new Date()
  const hoursLeft = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 3600000))
  const expiringSoon = hoursLeft < 24 && token.status === "active"

  return (
    <tr className="border-t border-slate-800 hover:bg-slate-800/40 transition-colors">
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs text-slate-400">{token.token.slice(0, 14)}…</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-sm text-white">{token.dataClientName}</div>
        <div className="text-xs text-slate-500 font-mono">{token.dataClientId.slice(0, 20)}…</div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-sm text-white">{token.dataOwnerName}</div>
        <div className="text-xs text-slate-500">{token.federationName}</div>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-lg">{EQ_ICON[token.equipmentType] ?? "📦"}</span>
        <span className="text-sm text-slate-300 ml-1">{token.equipmentType.toUpperCase()}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className={`text-xs ${expiringSoon ? "text-amber-400" : "text-slate-400"}`}>
          {expires.toLocaleDateString("en-GB")} {expires.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        {expiringSoon && <div className="text-xs text-amber-500">{hoursLeft}h left</div>}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="font-mono text-white text-sm">{token.usageCount}</span>
        {token.lastUsedAt && (
          <div className="text-xs text-slate-600">{new Date(token.lastUsedAt).toLocaleTimeString("en-GB")}</div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[token.status] ?? "text-slate-400 border-slate-700"}`}>
          {token.status}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {token.status === "active" && (
          <button
            onClick={() => onRevoke(token.id)}
            className="text-xs text-red-500 hover:text-red-300 border border-red-800 hover:border-red-600 px-2 py-0.5 rounded transition-colors"
          >
            revoke
          </button>
        )}
      </td>
    </tr>
  )
}

function LogRow({ entry }: { entry: AccessLogEntry }) {
  return (
    <tr className="border-t border-slate-800/60 hover:bg-slate-800/30 transition-colors text-xs">
      <td className="px-3 py-1.5 text-slate-500 font-mono whitespace-nowrap">
        {new Date(entry.timestamp).toLocaleTimeString("en-GB")}
      </td>
      <td className="px-3 py-1.5 text-slate-300">{entry.dataClientName}</td>
      <td className="px-3 py-1.5 text-slate-400">{entry.dataOwnerName}</td>
      <td className="px-3 py-1.5">
        <span className="text-slate-300">{EQ_ICON[entry.equipmentType]} {entry.equipmentType}</span>
      </td>
      <td className="px-3 py-1.5">
        <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${entry.endpoint === "data" ? "bg-sky-900/40 text-sky-300" : "bg-violet-900/40 text-violet-300"}`}>
          /{entry.endpoint}
        </span>
      </td>
      <td className="px-3 py-1.5">
        <span className={`font-mono font-semibold ${entry.success ? "text-emerald-400" : "text-red-400"}`}>
          {entry.statusCode}
        </span>
      </td>
      <td className="px-3 py-1.5 text-slate-500 font-mono">{entry.responseTimeMs}ms</td>
    </tr>
  )
}

export default function SidecarDashboard() {
  const [tokens, setTokens] = useState<SidecarToken[]>([])
  const [log, setLog] = useState<AccessLogEntry[]>([])
  const [status, setStatus] = useState<Status | null>(null)
  const [tick, setTick] = useState(0)
  const [activeTab, setActiveTab] = useState<"tokens" | "log" | "metrics">("tokens")

  const headers = { Authorization: `Bearer ${ADMIN}` }

  const poll = useCallback(async () => {
    try {
      const [tRes, lRes, sRes] = await Promise.all([
        fetch("/api/tokens", { headers }),
        fetch("/api/access-log?limit=50", { headers }),
        fetch("/api/status"),
      ])
      const [tData, lData, sData] = await Promise.all([tRes.json(), lRes.json(), sRes.json()])
      if (tData.tokens) setTokens(tData.tokens)
      if (lData.entries) setLog(lData.entries)
      setStatus(sData)
      setTick(t => t + 1)
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [poll])

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this token? The client will lose access immediately.")) return
    await fetch(`/api/tokens/${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    })
    await poll()
  }

  const st = status
  const online = st?.equipment.filter(e => e.status === "online").length ?? 0
  const total = st?.equipment.length ?? 3
  const successRate = st?.access.last24h
    ? Math.round((st.access.successful / st.access.last24h) * 100)
    : 100

  return (
    <main className="min-h-screen bg-slate-950 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xl">🔀</div>
            <div>
              <h1 className="text-xl font-bold text-white">INTRA Dataspace — Sidecar Proxy</h1>
              <p className="text-slate-500 text-sm">P2P access control · Metal-Mechanical Plant — Brazil Unit</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              <span className="text-slate-600">port:</span> 3100
            </span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              <span className="text-slate-600">proxy:</span> /api/proxy/&#123;equipment&#125;/&#123;endpoint&#125;
            </span>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              <span className="text-slate-600">register:</span> POST /api/tokens
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-emerald-400 font-semibold">online</span>
          </div>
          <span className="text-xs text-slate-600">#{tick} · {st ? new Date(st.timestamp).toLocaleTimeString("en-GB") : "--:--:--"}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active Tokens" value={st?.tokens.active ?? 0} sub={`${st?.tokens.total ?? 0} total`} accent />
        <StatCard label="Accesses 24h" value={st?.access.last24h ?? 0} sub={`${st?.access.total ?? 0} total`} />
        <StatCard label="Success Rate" value={`${successRate}%`} sub={`${st?.access.failed ?? 0} failed`} />
        <StatCard label="Equipment" value={`${online}/${total}`} sub={st?.equipment.map(e => `${EQ_ICON[e.type] ?? ""} ${e.status}`).join("  ") ?? ""} />
      </div>

      {/* Network Topology */}
      <TopologySection equipment={st?.equipment ?? []} />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-900 rounded-xl p-1 w-fit">
        {(["tokens", "log", "metrics"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            {tab === "tokens"
              ? `Tokens (${tokens.length})`
              : tab === "log"
              ? `Access Log (${log.length})`
              : "Metrics"}
          </button>
        ))}
      </div>

      {/* Tokens table */}
      {activeTab === "tokens" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  {["Token", "Client", "Owner / Federation", "Equipment", "Expires", "Uses", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-600">
                      No tokens registered.<br />
                      <span className="text-xs">The Dataspace registers tokens via POST /api/tokens after contracts are accepted.</span>
                    </td>
                  </tr>
                ) : (
                  tokens.map(t => <TokenRow key={t.id} token={t} onRevoke={handleRevoke} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Access log table */}
      {activeTab === "log" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  {["Time", "Client", "Owner", "Equip.", "Endpoint", "HTTP", "Time (ms)"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-600">
                      No access events logged yet.
                    </td>
                  </tr>
                ) : (
                  log.map(e => <LogRow key={e.id} entry={e} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metrics tab */}
      {activeTab === "metrics" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* DSP success rate */}
            <div className="bg-slate-900 rounded-2xl border border-emerald-900 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">DSP Success Rate</p>
              <p className="text-4xl font-bold font-mono text-emerald-400">{successRate}%</p>
              <p className="text-xs text-slate-500 mt-1">
                {st?.access.successful ?? 0} ok · {st?.access.failed ?? 0} failed (24h)
              </p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Ratio of P2P requests authorized by the sidecar proxy in the last 24h.
              </p>
            </div>

            {/* Avg latency */}
            <div className="bg-slate-900 rounded-2xl border border-sky-900 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg. Connector Latency</p>
              <p className="text-4xl font-bold font-mono text-sky-400">{st?.access.avgResponseMs ?? 0} ms</p>
              <p className="text-xs text-slate-500 mt-1">
                {st?.access.last24h ?? 0} accesses in the last 24h
              </p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Average response time when processing requests via proxy to the equipment.
              </p>
            </div>

            {/* Expired not renewed */}
            <div className="bg-slate-900 rounded-2xl border border-amber-900 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Expired Tokens w/o Renewal</p>
              <p className="text-4xl font-bold font-mono text-amber-400">{st?.tokens.expiredNotRenewed ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">
                of {st?.tokens.expired ?? 0} expired total
              </p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                Clients whose access expired without obtaining a new token — silent churn signal.
              </p>
            </div>
          </div>

          {/* References */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 text-xs text-slate-500 space-y-4">
            <p className="text-slate-400 font-semibold">Reference basis</p>

            <div className="space-y-1">
              <p className="text-slate-300 font-medium">DSP Success Rate · Avg. Latency</p>
              <p>Siska, V.; Karagiannis, V.; Drobics, M. <span className="italic">Building a Dataspace: Technical Overview</span>. Gaia-X Hub Austria, 2023.</p>
              <p className="text-slate-600 italic border-l border-slate-700 pl-2 mt-1">
                &ldquo;Data exchange services are responsible for the actual transactions including contracting, access and usage control, and <strong className="text-slate-500">logging</strong> transactions, <strong className="text-slate-500">auditing</strong>.&rdquo; (§2.2)
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-slate-300 font-medium">Expired Tokens w/o Renewal</p>
              <p>IDSA. <span className="italic">IDS Reference Architecture Model 4.0</span>. International Data Spaces Association, 2024.</p>
              <p className="text-slate-600 italic border-l border-slate-700 pl-2 mt-1">
                &ldquo;The control plane is responsible for all processes leading up to and following a transaction: <strong className="text-slate-500">identity and access management</strong>; handling offers; creating, negotiating, and settling contracts; <strong className="text-slate-500">logging</strong>.&rdquo; (§3.5)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-500 mb-2">Quick reference</p>
        <p><span className="text-slate-400">Register token (Dataspace → Sidecar):</span>  POST /api/tokens  · Authorization: Bearer {"{SIDECAR_ADMIN_SECRET}"}</p>
        <p><span className="text-slate-400">P2P access (Client → Sidecar):</span>  GET /api/proxy/{"{equipment}"}/{"{data|aas}"}  · Authorization: Bearer {"{token}"}</p>
        <p><span className="text-slate-400">Revoke:</span>  PATCH /api/tokens/{"{id}"}  · {"{ \"action\": \"revoke\" }"}</p>
        <p><span className="text-slate-400">Status:</span>  GET /api/status</p>
        <p className="pt-1">Auto-refresh: 3 s · Default admin secret: <span className="font-mono text-slate-400">admin</span> (set SIDECAR_ADMIN_SECRET)</p>
      </div>
    </main>
  )
}
