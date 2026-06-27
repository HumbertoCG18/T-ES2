import { FolderClosed, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { useStore } from "@/store/store"
import { ConversationItem } from "./ConversationItem"

/** Projetos e conversas fixados em Favoritos. Não renderiza nada se não houver favoritos. */
export function FavoritesSection() {
  const { state, openProject } = useStore()
  const favProjects = state.projects.filter((p) => p.favorite)
  const favConversations = state.conversations.filter((c) => c.favorite)
  const activeId = state.view.type === "chat" ? state.view.conversationId : null
  const activeProjectId =
    state.view.type === "project" ? state.view.projectId : null

  if (favProjects.length === 0 && favConversations.length === 0) return null

  return (
    <div>
      <h3 className="flex items-center gap-1.5 px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
        <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
        Favoritos
      </h3>
      <div className="flex flex-col gap-0.5">
        {favProjects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openProject(p.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              p.id === activeProjectId
                ? "bg-foreground/[0.07] text-foreground"
                : "text-foreground hover:bg-foreground/[0.05]",
            )}
            title={p.name}
          >
            <FolderClosed
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
        {favConversations.map((c) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            active={c.id === activeId}
          />
        ))}
      </div>
    </div>
  )
}
