import { FolderClosed, Plus, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { useStore } from "@/store/store"
import { NewProjectDialog } from "./NewProjectDialog"

export function ProjectList() {
  const { state, openProject, toggleProjectFavorite } = useStore()
  const activeProjectId =
    state.view.type === "project" ? state.view.projectId : null

  return (
    <div>
      <div className="flex items-center justify-between px-2.5 pb-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">Projetos</h3>
        <NewProjectDialog>
          <button
            type="button"
            aria-label="Novo projeto"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </NewProjectDialog>
      </div>

      {state.projects.length === 0 ? (
        <NewProjectDialog>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Novo projeto
          </button>
        </NewProjectDialog>
      ) : (
        <div className="flex flex-col gap-0.5">
          {state.projects.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group relative flex items-center rounded-lg transition-colors",
                p.id === activeProjectId
                  ? "bg-foreground/[0.07]"
                  : "hover:bg-foreground/[0.05]",
              )}
            >
              <button
                type="button"
                onClick={() => openProject(p.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-8 text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title={p.name}
              >
                <FolderClosed
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate">{p.name}</span>
              </button>
              <button
                type="button"
                onClick={() => toggleProjectFavorite(p.id)}
                aria-label={p.favorite ? "Remover dos favoritos" : "Favoritar projeto"}
                className={cn(
                  "absolute right-1 flex h-7 w-7 items-center justify-center rounded-md outline-none transition focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent",
                  p.favorite
                    ? "text-accent opacity-100"
                    : "text-muted-foreground opacity-0 hover:bg-foreground/[0.1] hover:text-foreground group-hover:opacity-100",
                )}
              >
                <Star
                  className={cn("h-4 w-4", p.favorite && "fill-accent")}
                  aria-hidden="true"
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
