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
  /** Escopo da busca RAG: só documentos deste projeto. Ausente = busca global. */
  projectId?: string
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
  if (opts.projectId) body.projectId = opts.projectId

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
 * `fileName` vira metadado (file_name) — aparece nas citações e no inventário do projeto.
 */
export async function ingestDocument(
  docId: string,
  projectId: string,
  text: string,
  fileName?: string,
): Promise<void> {
  const res = await fetch("/api/documents/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      docId,
      projectId,
      text,
      metadata: fileName ? { file_name: fileName } : undefined,
    }),
  })
  if (!res.ok) throw new Error(`http_error_${res.status}`)
}

// ---------- Modelos do Ollama (administração; via /api/models → agent-service) ----------

/** Modelo instalado no Ollama (subset de GET /api/tags). */
export interface OllamaModel {
  name: string
  size: number
  modifiedAt?: string
  parameterSize?: string
  quantization?: string
}

/** Lista os modelos instalados no Ollama. */
export async function listOllamaModels(): Promise<OllamaModel[]> {
  const res = await fetch("/api/models")
  if (!res.ok) throw new Error(`http_error_${res.status}`)
  const data = (await res.json()) as { models?: unknown }
  const models = Array.isArray(data.models) ? data.models : []
  return models
    .map((m) => {
      const o = m as Record<string, unknown>
      const details = (o.details ?? {}) as Record<string, unknown>
      return {
        name: String(o.name ?? ""),
        size: Number(o.size ?? 0),
        modifiedAt: typeof o.modified_at === "string" ? o.modified_at : undefined,
        parameterSize:
          typeof details.parameter_size === "string" ? details.parameter_size : undefined,
        quantization:
          typeof details.quantization_level === "string" ? details.quantization_level : undefined,
      }
    })
    .filter((m) => m.name)
}

/** Evento de progresso do download (NDJSON do Ollama). `completed`/`total` são da camada atual. */
export interface PullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
}

/**
 * Baixa um modelo no Ollama com progresso em streaming: lê o NDJSON da resposta linha a linha e
 * chama `onProgress` a cada evento. Cancelável via `AbortSignal`. Lança se o Ollama reportar erro.
 */
export async function pullOllamaModel(
  model: string,
  onProgress: (p: PullProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/models/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`http_error_${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        let evt: Record<string, unknown>
        try {
          evt = JSON.parse(line) as Record<string, unknown>
        } catch {
          continue // linha parcial/inválida
        }
        if (typeof evt.error === "string") throw new Error(evt.error)
        onProgress({
          status: typeof evt.status === "string" ? evt.status : "",
          digest: typeof evt.digest === "string" ? evt.digest : undefined,
          total: typeof evt.total === "number" ? evt.total : undefined,
          completed: typeof evt.completed === "number" ? evt.completed : undefined,
        })
      }
    }
  } catch (err) {
    // Cancelamento pelo usuário (AbortController) não é erro: encerra em silêncio.
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return
    throw err
  } finally {
    reader.releaseLock()
  }
}

/** Remove um modelo instalado. */
export async function deleteOllamaModel(name: string): Promise<void> {
  const res = await fetch(`/api/models/${encodeURIComponent(name)}`, { method: "DELETE" })
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
