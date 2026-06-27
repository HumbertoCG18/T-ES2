import { useEffect, useRef, useState } from "react"
import { FolderInput, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStore } from "@/store/store"
import type { Conversation } from "@/store/types"

export function ConversationItem({
  conversation,
  active,
}: {
  conversation: Conversation
  active: boolean
}) {
  const {
    state,
    selectConversation,
    renameConversation,
    deleteConversation,
    moveConversation,
    toggleConversationFavorite,
  } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const startRename = () => {
    setDraft(conversation.title)
    setEditing(true)
  }

  const commitRename = () => {
    const next = draft.trim()
    if (next) renameConversation(conversation.id, next)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename()
          if (e.key === "Escape") setEditing(false)
        }}
        className="w-full rounded-lg border border-accent/40 bg-card px-2.5 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Renomear conversa"
      />
    )
  }

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg transition-colors",
        active
          ? "bg-foreground/[0.07]"
          : "hover:bg-foreground/[0.05]",
      )}
    >
      <button
        type="button"
        onClick={() => selectConversation(conversation.id)}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-2 pl-2.5 pr-8 text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        title={conversation.title}
      >
        {conversation.favorite && (
          <Star
            className="h-3 w-3 shrink-0 fill-accent text-accent"
            aria-label="Favorita"
          />
        )}
        <span className="truncate">{conversation.title}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opções da conversa"
          className={cn(
            "absolute right-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-foreground/[0.1] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 data-[state=open]:opacity-100",
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => toggleConversationFavorite(conversation.id)}>
            <Star aria-hidden="true" />
            {conversation.favorite ? "Remover dos favoritos" : "Favoritar"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={startRename}>
            <Pencil aria-hidden="true" />
            Renomear
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput aria-hidden="true" />
              Mover para projeto
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={conversation.projectId ?? ""}
                onValueChange={(v) =>
                  moveConversation(conversation.id, v === "" ? null : v)
                }
              >
                <DropdownMenuRadioItem value="">
                  Sem projeto
                </DropdownMenuRadioItem>
                {state.projects.length > 0 && <DropdownMenuSeparator />}
                {state.projects.map((p) => (
                  <DropdownMenuRadioItem key={p.id} value={p.id}>
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            danger
            onSelect={() => deleteConversation(conversation.id)}
          >
            <Trash2 aria-hidden="true" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
