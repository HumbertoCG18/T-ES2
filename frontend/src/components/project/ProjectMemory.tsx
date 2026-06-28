import { useState, type KeyboardEvent } from "react"
import { Brain, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/store/store"
import type { Project } from "@/store/types"

/** Notas de memória do projeto: adicionar, listar e remover. */
export function ProjectMemory({ project }: { project: Project }) {
  const { addProjectMemory, removeProjectMemory } = useStore()
  const [draft, setDraft] = useState("")

  const add = () => {
    const note = draft.trim()
    if (!note) return
    addProjectMemory(project.id, note)
    setDraft("")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      add()
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Memória</h3>
      </div>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Fatos e preferências que o projeto deve lembrar.
      </p>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex.: o cliente prefere respostas curtas"
          aria-label="Nova nota de memória"
        />
        <Button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="h-10 shrink-0 gap-1.5 px-3 text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar
        </Button>
      </div>

      {project.memory.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {project.memory.map((note, i) => (
            <li
              key={i}
              className="group flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words">{note}</span>
              <button
                type="button"
                onClick={() => removeProjectMemory(project.id, i)}
                aria-label="Remover nota"
                className="shrink-0 rounded-md p-1 text-muted-foreground opacity-100 outline-none transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent md:opacity-0 md:group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Nenhuma nota ainda.
        </p>
      )}
    </section>
  )
}
