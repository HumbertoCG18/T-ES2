import { useEffect, useRef, useState } from "react"
import { Menu, PanelLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { useStore } from "@/store/store"
import { ModelSelector } from "./ModelSelector"

function EditableTitle() {
  const { activeConversation, renameConversation } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (!activeConversation) {
    return (
      <span className="truncate text-sm font-medium text-muted-foreground">
        Nova conversa
      </span>
    )
  }

  const commit = () => {
    const next = draft.trim()
    if (next) renameConversation(activeConversation.id, next)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setEditing(false)
        }}
        className="w-full max-w-md rounded-md bg-foreground/[0.06] px-2 py-1 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Título da conversa"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(activeConversation.title)
        setEditing(true)
      }}
      className="truncate rounded-md px-2 py-1 text-sm font-medium text-foreground outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-accent"
      title="Renomear conversa"
    >
      {activeConversation.title}
    </button>
  )
}

interface TopBarProps {
  collapsed: boolean
  onExpand: () => void
  onOpenMobile: () => void
}

export function TopBar({ collapsed, onExpand, onOpenMobile }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background/80 px-3 backdrop-blur">
      <Button
        variant="iconGhost"
        className="md:hidden"
        onClick={onOpenMobile}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      {collapsed && (
        <Tooltip label="Expandir barra lateral" side="bottom">
          <Button
            variant="iconGhost"
            className="hidden md:inline-flex"
            onClick={onExpand}
            aria-label="Expandir barra lateral"
          >
            <PanelLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Tooltip>
      )}

      <div className="flex min-w-0 flex-1 items-center">
        <EditableTitle />
      </div>

      <ModelSelector />
    </header>
  )
}
