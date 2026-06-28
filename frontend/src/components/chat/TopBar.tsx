import { useEffect, useRef, useState } from "react"
import { FolderClosed, Menu, PanelLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { useStore } from "@/store/store"
import { ConversationOptions } from "./ConversationOptions"
import { ModelSelector } from "./ModelSelector"

function EditableTitle() {
  const { activeConversation, renameConversation, state, openProject } = useStore()
  const project = activeConversation?.projectId
    ? state.projects.find((p) => p.id === activeConversation.projectId)
    : null
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
    <div className="flex min-w-0 items-center">
      {project && (
        <>
          <button
            type="button"
            onClick={() => openProject(project.id)}
            className="flex max-w-[40%] shrink-0 items-center gap-1.5 truncate rounded-md px-2 py-1 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
            title={`Projeto: ${project.name}`}
          >
            <FolderClosed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{project.name}</span>
          </button>
          <span className="px-0.5 text-muted-foreground/50" aria-hidden="true">
            /
          </span>
        </>
      )}
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
    </div>
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

      <ConversationOptions />
      <ModelSelector />
    </header>
  )
}
