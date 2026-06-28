import { useMemo, useState } from "react"
import { ArrowDownUp, FileText, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { ViewHeader } from "@/components/layout/ViewHeader"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NewProjectDialog } from "@/components/sidebar/NewProjectDialog"
import { formatRelativeTime } from "@/lib/dates"
import { useStore } from "@/store/store"

interface ProjectsGalleryViewProps {
  collapsed: boolean
  onExpand: () => void
  onOpenMobile: () => void
}

type SortKey = "recent" | "name" | "files"

const SORT_LABEL: Record<SortKey, string> = {
  recent: "Mais recentes",
  name: "Nome",
  files: "Mais arquivos",
}

export function ProjectsGalleryView({
  collapsed,
  onExpand,
  onOpenMobile,
}: ProjectsGalleryViewProps) {
  const { state, openProject } = useStore()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("recent")

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = state.projects.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.instructions.toLowerCase().includes(q),
    )
    const sorted = [...filtered]
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === "files") sorted.sort((a, b) => b.files.length - a.files.length)
    else sorted.sort((a, b) => b.createdAt - a.createdAt)
    return sorted
  }, [state.projects, query, sort])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title="Projetos"
        collapsed={collapsed}
        onExpand={onExpand}
        onOpenMobile={onOpenMobile}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Projetos
            </h1>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-accent">
                  <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  {SORT_LABEL[sort]}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    <DropdownMenuRadioItem value="recent">Mais recentes</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name">Nome</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="files">Mais arquivos</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <NewProjectDialog>
                <Button>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Novo projeto
                </Button>
              </NewProjectDialog>
            </div>
          </div>

          <SearchInput
            wrapperClassName="mt-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar projetos…"
            aria-label="Procurar projetos"
          />

          {list.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {state.projects.length === 0
                  ? "Nenhum projeto ainda."
                  : "Nenhum projeto encontrado."}
              </p>
              {state.projects.length === 0 && (
                <NewProjectDialog>
                  <Button className="mt-3">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Criar projeto
                  </Button>
                </NewProjectDialog>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProject(p.id)}
                  className="flex flex-col rounded-xl border border-border bg-card p-4 text-left outline-none transition-colors hover:border-accent/40 hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="truncate text-sm font-semibold text-foreground">
                    {p.name}
                  </span>
                  {p.instructions.trim() && (
                    <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.instructions.trim()}
                    </span>
                  )}
                  <span className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Criado {formatRelativeTime(p.createdAt)}</span>
                    {p.files.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        {p.files.length}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
