import { useEffect, useRef, useState } from "react"
import { FolderClosed, MessageSquare, MoreHorizontal, Star, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewHeader } from "@/components/layout/ViewHeader"
import { Composer } from "@/components/chat/Composer"
import { useStore } from "@/store/store"
import type { Project } from "@/store/types"
import { ProjectFiles } from "./ProjectFiles"
import { ProjectMemory } from "./ProjectMemory"

interface ProjectViewProps {
  project: Project
  collapsed: boolean
  onExpand: () => void
  onOpenMobile: () => void
}

function EditableName({ project }: { project: Project }) {
  const { updateProject } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    if (next && next !== project.name) updateProject(project.id, { name: next })
    else setDraft(project.name)
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
          if (e.key === "Escape") {
            setDraft(project.name)
            setEditing(false)
          }
        }}
        className="w-full rounded-lg bg-foreground/[0.06] px-2 py-1 font-display text-2xl font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Nome do projeto"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(project.name)
        setEditing(true)
      }}
      className="rounded-lg px-2 py-1 text-left font-display text-2xl font-normal text-foreground outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      title="Renomear projeto"
    >
      {project.name}
    </button>
  )
}

function Instructions({ project }: { project: Project }) {
  const { updateProject } = useStore()
  const [value, setValue] = useState(project.instructions)

  useEffect(() => {
    setValue(project.instructions)
  }, [project.id, project.instructions])

  const commit = () => {
    if (value !== project.instructions)
      updateProject(project.id, { instructions: value })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <label
        htmlFor="project-instructions"
        className="text-sm font-medium text-foreground"
      >
        Instruções do projeto
      </label>
      <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
        Orientações aplicadas às conversas deste projeto.
      </p>
      <Textarea
        id="project-instructions"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        rows={4}
        placeholder="Ex.: responda sempre em português, cite as fontes…"
        className="min-h-[6rem] rounded-lg border border-border bg-background p-3 text-sm focus-visible:border-accent/40"
      />
    </div>
  )
}

export function ProjectView({
  project,
  collapsed,
  onExpand,
  onOpenMobile,
}: ProjectViewProps) {
  const {
    state,
    selectConversation,
    sendMessage,
    deleteProject,
    deleteConversation,
    toggleProjectFavorite,
  } = useStore()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const conversations = state.conversations
    .filter((c) => c.projectId === project.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title={project.name}
        collapsed={collapsed}
        onExpand={onExpand}
        onOpenMobile={onOpenMobile}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8">
          {/* Cabeçalho do projeto: nome editável + menu de opções. */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <FolderClosed className="h-3.5 w-3.5" aria-hidden="true" />
                Projeto
              </div>
              <EditableName project={project} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Opções do projeto"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-foreground/[0.05]"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => toggleProjectFavorite(project.id)}>
                  <Star aria-hidden="true" />
                  {project.favorite ? "Remover dos favoritos" : "Favoritar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger onSelect={() => setConfirmOpen(true)}>
                  <Trash2 aria-hidden="true" />
                  Excluir projeto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Excluir projeto?</DialogTitle>
                <DialogDescription>
                  “{project.name}” será removido, junto com os arquivos do seu
                  conhecimento (RAG). As conversas deste projeto são mantidas, apenas
                  sem o projeto.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="dangerSolid"
                  onClick={() => {
                    deleteProject(project.id)
                    setConfirmOpen(false)
                  }}
                >
                  Excluir
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* Coluna central: input (cria conversa no projeto) + lista de conversas. */}
            <div className="flex min-w-0 flex-col gap-6">
              <div>
                <h2 className="mb-2 px-1 text-sm font-medium text-foreground">
                  Nova conversa neste projeto
                </h2>
                <Composer onSend={sendMessage} autoFocus />
              </div>

              <section>
                <h2 className="text-sm font-semibold text-foreground">
                  Conversas{" "}
                  <span className="font-normal text-muted-foreground">
                    ({conversations.length})
                  </span>
                </h2>
                <div className="mt-3 flex flex-col gap-1.5">
                  {conversations.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma conversa neste projeto ainda. Envie uma mensagem
                      acima para começar.
                    </p>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.id}
                        className="group flex items-center gap-1 rounded-xl border border-border bg-card pr-2 transition-colors hover:border-accent/30 hover:bg-foreground/[0.03]"
                      >
                        <button
                          type="button"
                          onClick={() => selectConversation(c.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <MessageSquare
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm font-medium text-foreground">
                            {c.title}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {c.messages.length}{" "}
                            {c.messages.length === 1 ? "mensagem" : "mensagens"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteConversation(c.id)}
                          aria-label={`Excluir conversa “${c.title}”`}
                          title="Excluir conversa"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            {/* Painel lateral: instruções + memória + conhecimento (arquivos). */}
            <aside className="flex flex-col gap-4">
              <Instructions project={project} />
              <ProjectMemory project={project} />
              <ProjectFiles project={project} />
            </aside>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
