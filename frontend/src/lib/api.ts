import type { Citation } from "@/store/types"

export interface ChatResponse {
  reply: string
  trace: string[]
  conversationId?: string
  citations: Citation[]
}

export interface ChatOptions {
  conversationId?: string
  /** Nome lógico do modelo no llm-gateway (ex.: "chat", "chat-light"). */
  model?: string
  /** Nível de esforço do agente: "rapido" | "equilibrado" | "profundo". */
  effort?: string
  /** Modo raciocínio (passos antes da resposta). */
  thinking?: boolean
  useMemory?: boolean
  useRag?: boolean
}

/**
 * Envia uma mensagem para a plataforma de agentes. Passa conversationId, modelo e os toggles
 * de memória/RAG da conversa. Sem conversationId, o backend gera um id stateless (back-compat).
 */
export async function sendChat(message: string, opts: ChatOptions = {}): Promise<ChatResponse> {
  const body: Record<string, unknown> = { message }
  if (opts.conversationId) body.conversationId = opts.conversationId
  if (opts.model) body.model = opts.model
  if (opts.effort) body.effort = opts.effort
  if (opts.thinking) body.thinking = true
  if (opts.useMemory === false) body.useMemory = false
  if (opts.useRag === false) body.useRag = false

  let res: Response
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("network_error")
  }

  if (!res.ok) {
    throw new Error(`http_error_${res.status}`)
  }

  const data = (await res.json()) as Partial<ChatResponse>
  return {
    reply: typeof data.reply === "string" ? data.reply : "",
    trace: Array.isArray(data.trace) ? data.trace : [],
    conversationId: typeof data.conversationId === "string" ? data.conversationId : undefined,
    citations: Array.isArray(data.citations) ? data.citations : [],
  }
}

/** Mensagem persistida na memória (role + content). */
export interface MemoryMessage {
  role: string
  content: string
}

/** Histórico durável de uma conversa (via /api/memory/{id} → memory-service). */
export async function fetchMemory(conversationId: string): Promise<MemoryMessage[]> {
  const res = await fetch(`/api/memory/${encodeURIComponent(conversationId)}`)
  if (!res.ok) throw new Error(`http_error_${res.status}`)
  const data = (await res.json()) as unknown
  return Array.isArray(data) ? (data as MemoryMessage[]) : []
}

/** Limpa a memória (Redis + Postgres) de uma conversa. */
export async function clearMemory(conversationId: string): Promise<void> {
  const res = await fetch(`/api/memory/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error(`http_error_${res.status}`)
}

/** Parâmetro de uma ferramenta (subset do JSON Schema). */
export interface ToolParam {
  name: string
  type?: string
  description?: string
  required: boolean
}

/** Ferramenta exposta pelo tool-registry. */
export interface ToolInfo {
  name: string
  description: string
  params: ToolParam[]
}

/**
 * Envia um documento para indexação RAG (assíncrona) via api-gateway:
 * POST /api/documents/ingest → agent-service publica em document.ingest →
 * retrieval-service consome e indexa no ChromaDB. Responde 202 (indexação acontece depois).
 */
export async function ingestDocument(
  docId: string,
  projectId: string,
  text: string,
): Promise<void> {
  const res = await fetch("/api/documents/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId, projectId, text }),
  })
  if (!res.ok) throw new Error(`http_error_${res.status}`)
}

/** Serviço registrado no Eureka (saúde ao vivo). */
export interface ServiceStatus {
  name: string
  instances: number
}

/** Saúde dos serviços via api-gateway (GET /api/services → DiscoveryClient do agent-service). */
export async function fetchServices(): Promise<ServiceStatus[]> {
  const res = await fetch("/api/services")
  if (!res.ok) throw new Error(`http_error_${res.status}`)
  const data = (await res.json()) as unknown
  return Array.isArray(data) ? (data as ServiceStatus[]) : []
}

/**
 * Busca as ferramentas registradas no tool-registry (ao vivo, via api-gateway: GET /api/tools).
 * O backend devolve [{type:"function", function:{name, description, parameters}}].
 */
export async function fetchTools(): Promise<ToolInfo[]> {
  const res = await fetch("/api/tools")
  if (!res.ok) throw new Error(`http_error_${res.status}`)
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) return []

  return data
    .map((entry) => (entry as { function?: unknown }).function)
    .filter((fn): fn is Record<string, unknown> => !!fn)
    .map((fn) => {
      const params = (fn.parameters ?? {}) as {
        properties?: Record<string, { type?: string; description?: string }>
        required?: string[]
      }
      const required = new Set(params.required ?? [])
      const props = params.properties ?? {}
      return {
        name: String(fn.name ?? ""),
        description: String(fn.description ?? ""),
        params: Object.entries(props).map(([name, schema]) => ({
          name,
          type: schema?.type,
          description: schema?.description,
          required: required.has(name),
        })),
      }
    })
}
