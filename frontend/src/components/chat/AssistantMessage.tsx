import { Check, Copy, RefreshCw } from "lucide-react"

import { useCopy } from "@/lib/useCopy"
import { useStore } from "@/store/store"
import type { ChatMessage } from "@/store/types"
import { Markdown } from "./Markdown"
import { MessageActionButton } from "./MessageActionButton"
import { Trace } from "./Trace"

function ThinkingDots() {
  return (
    <span
      className="flex items-center gap-1.5 py-1.5"
      role="status"
      aria-label="O agente está pensando"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="thinking-dot h-2 w-2 rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  )
}

interface AssistantMessageProps {
  message: ChatMessage
  conversationId: string
  /** É a última resposta do assistente da conversa? (habilita "Regenerar") */
  isLast: boolean
}

/** Resposta do agente: Markdown rico, trace e toolbar (copiar / regenerar). */
export function AssistantMessage({
  message,
  conversationId,
  isLast,
}: AssistantMessageProps) {
  const { regenerateLast, isLoading } = useStore()
  const { copied, copy } = useCopy()

  const showActions = !message.pending && !message.error

  return (
    <div className="group flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
        <span className="text-xs font-medium text-muted-foreground">Agente</span>
      </div>

      {message.pending ? (
        <ThinkingDots />
      ) : message.error ? (
        <p className="text-[0.95rem] leading-[1.7] text-muted-foreground">
          {message.content}
        </p>
      ) : (
        // data-quotable: habilita "Citar" ao selecionar trecho desta resposta.
        <div data-quotable>
          <Markdown content={message.content} />
        </div>
      )}

      {message.trace && message.trace.length > 0 && (
        <Trace trace={message.trace} />
      )}

      {showActions && (
        <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <MessageActionButton
            icon={copied ? Check : Copy}
            label={copied ? "Copiado" : "Copiar resposta"}
            onClick={() => copy(message.content)}
            active={copied}
          />
          {isLast && (
            <MessageActionButton
              icon={RefreshCw}
              label="Regenerar"
              onClick={() => regenerateLast(conversationId)}
              disabled={isLoading}
            />
          )}
          <span aria-live="polite" className="sr-only">
            {copied ? "Resposta copiada para a área de transferência" : ""}
          </span>
        </div>
      )}
    </div>
  )
}
