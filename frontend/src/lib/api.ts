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
