import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCopy } from "@/lib/useCopy"
import { useStore } from "@/store/store"
import type { ChatMessage } from "@/store/types"
import { Citations } from "./Citations"
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
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3.5 py-2.5 text-[0.95rem] leading-[1.6] text-foreground">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span>{message.content}</span>
          </div>
          {isLast && (
            <div>
              <Button
                variant="secondary"
                onClick={() => regenerateLast(conversationId)}
                disabled={isLoading}
                className="h-8 px-3 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      ) : (
        // data-quotable: habilita "Citar" ao selecionar trecho desta resposta.
        <div data-quotable>
          <Markdown content={message.content} />
        </div>
      )}

      {message.trace && message.trace.length > 0 && (
        <Trace trace={message.trace} />
      )}

      {message.citations && message.citations.length > 0 && (
        <Citations citations={message.citations} />
      )}

      {showActions && (
        <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
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
