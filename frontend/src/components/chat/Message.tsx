import type { ChatMessage } from "@/store/types"
import { AssistantMessage } from "./AssistantMessage"
import { UserMessage } from "./UserMessage"

interface MessageProps {
  message: ChatMessage
  conversationId: string
  /** Índice da mensagem na conversa (usado ao editar/truncar). */
  index: number
  /** É a última resposta do assistente? (habilita "Regenerar") */
  isLastAssistant: boolean
}

export function Message({
  message,
  conversationId,
  index,
  isLastAssistant,
}: MessageProps) {
  if (message.role === "user") {
    return (
      <UserMessage
        message={message}
        conversationId={conversationId}
        index={index}
      />
    )
  }

  return (
    <AssistantMessage
      message={message}
      conversationId={conversationId}
      isLast={isLastAssistant}
    />
  )
}
