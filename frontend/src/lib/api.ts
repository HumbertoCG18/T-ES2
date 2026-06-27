export interface ChatResponse {
  reply: string
  trace: string[]
  conversationId?: string
}

/**
 * Envia uma mensagem para a plataforma de agentes.
 * Passa o `conversationId` da conversa ativa para ativar memória/RAG por conversa
 * (Entrega 3). Sem ele, o backend gera um id stateless (back-compat).
 * Lança em caso de falha de rede ou resposta inválida, para que a UI
 * possa exibir uma mensagem amigável.
 */
export async function sendChat(message: string, conversationId?: string): Promise<ChatResponse> {
  let res: Response
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conversationId ? { message, conversationId } : { message }),
    })
  } catch {
    // Falha de rede (serviço fora do ar, DNS, etc.)
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
  }
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
