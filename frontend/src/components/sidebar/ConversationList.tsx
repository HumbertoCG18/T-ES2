import { useMemo } from "react"
import { FolderClosed } from "lucide-react"

import {
  groupConversationsByDate,
  groupConversationsByProject,
} from "@/lib/dates"
import { useStore } from "@/store/store"
import { ConversationItem } from "./ConversationItem"

export function ConversationList({ query }: { query: string }) {
  const { state, openProject } = useStore()
  const activeId =
    state.view.type === "chat" ? state.view.conversationId : null

  const { projectGroups, dateGroups } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? state.conversations.filter((c) => {
          if (c.title.toLowerCase().includes(q)) return true
          return c.messages.some((m) => m.content.toLowerCase().includes(q))
        })
      : state.conversations
    const { projectGroups, loose } = groupConversationsByProject(
      filtered,
      state.projects,
    )
    return { projectGroups, dateGroups: groupConversationsByDate(loose) }
  }, [state.conversations, state.projects, query])

  if (state.conversations.length === 0) {
    return (
      <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
        Nenhuma conversa ainda.
      </p>
    )
  }

  if (projectGroups.length === 0 && dateGroups.length === 0) {
    return (
      <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
        Nada encontrado para “{query.trim()}”.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Conversas agrupadas por projeto */}
      {projectGroups.map((group) => (
        <div key={group.projectId}>
          <button
            type="button"
            onClick={() => openProject(group.projectId)}
            className="flex w-full items-center gap-1.5 rounded-md px-2.5 pb-1.5 pt-0.5 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            title={`Abrir projeto ${group.label}`}
          >
            <FolderClosed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{group.label}</span>
            <span className="text-muted-foreground/50">{group.items.length}</span>
          </button>
          <div className="flex flex-col gap-0.5">
            {group.items.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === activeId}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Conversas sem projeto, agrupadas por data */}
      {dateGroups.map((group) => (
        <div key={group.label}>
          <h3 className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
            {group.label}
          </h3>
          <div className="flex flex-col gap-0.5">
            {group.items.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === activeId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
