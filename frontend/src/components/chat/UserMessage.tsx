import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/store/store"
import type { ChatMessage } from "@/store/types"
import { AttachmentList } from "./AttachmentList"
import { MessageActionButton } from "./MessageActionButton"

interface UserMessageProps {
  message: ChatMessage
  conversationId: string
  index: number
}

/**
 * Mensagem do usuário. Ao editar, vira um textarea inline; salvar TRUNCA a
 * conversa a partir daqui e reenvia (gera nova resposta do agente).
 */
export function UserMessage({ message, conversationId, index }: UserMessageProps) {
  const { editAndResend, isLoading } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      const el = textareaRef.current
      if (el) {
        el.focus()
        const end = el.value.length
        el.setSelectionRange(end, end)
        el.style.height = "auto"
        el.style.height = `${Math.min(el.scrollHeight, 280)}px`
      }
    }
  }, [editing])

  const startEdit = () => {
    setDraft(message.content)
    setEditing(true)
  }

  const cancel = () => {
    setDraft(message.content)
    setEditing(false)
  }

  const save = () => {
    const next = draft.trim()
    if (!next) return
    setEditing(false)
    editAndResend(conversationId, index, next)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      save()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%] rounded-2xl border border-accent/40 bg-card p-2 shadow-sm">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="max-h-[280px] p-2 text-[0.95rem] leading-relaxed"
            aria-label="Editar mensagem"
          />
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={cancel}
              className="h-8 px-3 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={!draft.trim()}
              className="h-8 px-3 text-xs"
            >
              Salvar e reenviar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col items-end">
      <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-user-bubble px-4 py-2.5 text-[0.95rem] leading-relaxed text-foreground">
        {message.content}
        {message.attachments && (
          <AttachmentList attachments={message.attachments} />
        )}
      </div>
      <div className="mt-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <MessageActionButton
          icon={Pencil}
          label="Editar"
          onClick={startEdit}
          disabled={isLoading}
        />
      </div>
    </div>
  )
}
