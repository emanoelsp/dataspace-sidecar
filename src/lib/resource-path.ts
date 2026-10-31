// Recursos de dados de um CPS (ex.: 5 catálogos na mesma API, cada um num path).
// O consumidor chama /api/proxy/{slug}/{resourceId}; o PEP traduz para o path
// registrado pelo Dataspace. "data" e "aas" continuam fixos em /api/data e /api/aas.

export interface SidecarResource {
  id: string
  name?: string
  path: string
}

const RESOURCE_ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/
const BUILTIN_ENDPOINTS = ["data", "aas"]
const MAX_RESOURCES = 32

/** Valida `resources` do registro. Retorna a mensagem de erro (string) ou a lista. */
export function parseResources(input: unknown): SidecarResource[] | string {
  if (input === undefined) return []
  if (!Array.isArray(input)) return "resources must be an array"
  if (input.length > MAX_RESOURCES) return `resources: at most ${MAX_RESOURCES} items`
  const seen = new Set<string>()
  const out: SidecarResource[] = []
  for (const raw of input) {
    const r = (raw ?? {}) as Record<string, unknown>
    const id = String(r.id ?? "").trim()
    const path = String(r.path ?? "").trim()
    if (!RESOURCE_ID_RE.test(id) || BUILTIN_ENDPOINTS.includes(id) || seen.has(id)) {
      return `resources: invalid or duplicated id "${id}"`
    }
    if (!path.startsWith("/") || path.includes("..") || path.includes("://")) {
      return `resources: path of "${id}" must be an absolute path on the CPS`
    }
    seen.add(id)
    out.push({ id, path, ...(r.name ? { name: String(r.name) } : {}) })
  }
  return out
}

/** Path no CPS para o endpoint pedido; null = endpoint desconhecido. */
export function upstreamPath(endpoint: string, resources: SidecarResource[] = []): string | null {
  if (BUILTIN_ENDPOINTS.includes(endpoint)) return `/api/${endpoint}`
  return resources.find(r => r.id === endpoint)?.path ?? null
}

export function availableEndpoints(resources: SidecarResource[] = []): string[] {
  return [...BUILTIN_ENDPOINTS, ...resources.map(r => r.id)]
}
