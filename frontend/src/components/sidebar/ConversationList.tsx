import { useMemo } from "react"

import { groupConversationsByDate } from "@/lib/dates"
import { useStore } from "@/store/store"
import { ConversationItem } from "./ConversationItem"

export function ConversationList({ query }: { query: string }) {
  const { state } = useStore()
  const activeId =
    state.view.type === "chat" ? state.view.conversationId : null

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? state.conversations.filter((c) => {
          if (c.title.toLowerCase().includes(q)) return true
          return c.messages.some((m) => m.content.toLowerCase().includes(q))
        })
      : state.conversations
    return groupConversationsByDate(filtered)
  }, [state.conversations, query])

  if (state.conversations.length === 0) {
    return (
      <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
        Nenhuma conversa ainda.
      </p>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
        Nada encontrado para “{query.trim()}”.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
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
