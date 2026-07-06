import { useEffect, useRef } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatMessage } from "@/store/types"
import { Message } from "./Message"
import { SelectionQuote } from "./SelectionQuote"

export function MessageList({
  messages,
  conversationId,
}: {
  messages: ChatMessage[]
  conversationId: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)

  // Mantém o scroll no fim quando chegam mensagens / a resposta atualiza.
  const lastLen = messages.length
  const lastContent = messages.at(-1)?.content ?? ""
  const lastPending = messages.at(-1)?.pending ?? false
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lastLen, lastContent, lastPending])

  // Índice da última resposta do assistente (para habilitar "Regenerar").
  let lastAssistantIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIndex = i
      break
    }
  }

  return (
    <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-8">
        {messages.map((m, i) => (
          <Message
            key={m.id}
            message={m}
            conversationId={conversationId}
            index={i}
            isLastAssistant={i === lastAssistantIndex}
          />
        ))}
      </div>
      <SelectionQuote />
    </ScrollArea>
  )
}
