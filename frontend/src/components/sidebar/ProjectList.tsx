import { FolderClosed, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { useStore } from "@/store/store"
import { NewProjectDialog } from "./NewProjectDialog"

export function ProjectList() {
  const { state, openProject } = useStore()
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
        </div>
      )}
    </div>
  )
}
