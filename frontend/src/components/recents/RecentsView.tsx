import { useMemo, useState } from "react"
import { Check, Filter, FolderClosed, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { ViewHeader } from "@/components/layout/ViewHeader"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/dates"
import { useStore } from "@/store/store"

interface RecentsViewProps {
  collapsed: boolean
  onExpand: () => void
  onOpenMobile: () => void
}

export function RecentsView({ collapsed, onExpand, onOpenMobile }: RecentsViewProps) {
  const { state, newConversation, selectConversation, deleteConversation } =
    useStore()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<string>("all") // all | none | projectId
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const projectName = (id: string | null) =>
    id ? state.projects.find((p) => p.id === id)?.name : undefined

  const filterLabel =
    filter === "all"
      ? "Todos"
      : filter === "none"
        ? "Sem projeto"
        : (projectName(filter) ?? "Projeto")

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...state.conversations]
      .filter((c) =>
        filter === "all"
          ? true
          : filter === "none"
            ? !c.projectId
            : c.projectId === filter,
      )
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => m.content.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [state.conversations, state.projects, query, filter])

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const exitSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const deleteSelected = () => {
    selected.forEach((id) => deleteConversation(id))
    exitSelect()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title="Conversas"
        collapsed={collapsed}
        onExpand={onExpand}
        onOpenMobile={onOpenMobile}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          {/* Cabeçalho + ações */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Conversas
            </h1>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-accent">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  {filterLabel}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={filter} onValueChange={setFilter}>
                    <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="none">Sem projeto</DropdownMenuRadioItem>
                    {state.projects.length > 0 && <DropdownMenuSeparator />}
                    {state.projects.map((p) => (
                      <DropdownMenuRadioItem key={p.id} value={p.id}>
                        <span className="truncate">{p.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {selectMode ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={deleteSelected}
                    disabled={selected.size === 0}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Excluir ({selected.size})
                  </Button>
                  <Button variant="ghost" onClick={exitSelect}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setSelectMode(true)}>
                  Selecionar chats
                </Button>
              )}

              <Button onClick={() => newConversation()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Novo bate-papo
              </Button>
            </div>
          </div>

          {/* Busca */}
          <SearchInput
            wrapperClassName="mt-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar chats…"
            aria-label="Pesquisar chats"
          />

          {/* Lista */}
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
            {list.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma conversa.
              </li>
            ) : (
              list.map((c) => {
                const pname = projectName(c.projectId)
                const isSel = selected.has(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() =>
                        selectMode ? toggleSel(c.id) : selectConversation(c.id)
                      }
                      className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {selectMode && (
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            isSel
                              ? "border-accent bg-accent text-white"
                              : "border-border",
                          )}
                          aria-hidden="true"
                        >
                          {isSel && <Check className="h-3 w-3" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {c.title}
                      </span>
                      {pname && (
                        <span className="hidden shrink-0 items-center gap-1 rounded-md bg-foreground/[0.05] px-1.5 py-0.5 text-xs text-muted-foreground sm:inline-flex">
                          <FolderClosed className="h-3 w-3" aria-hidden="true" />
                          <span className="max-w-[10rem] truncate">{pname}</span>
                        </span>
                      )}
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatRelativeTime(c.updatedAt)}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      </ScrollArea>
    </div>
  )
}
