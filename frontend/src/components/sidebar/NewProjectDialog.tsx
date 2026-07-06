import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/store/store"

export function NewProjectDialog({ children }: { children: ReactNode }) {
  const { createProject, openProject } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [instructions, setInstructions] = useState("")

  const reset = () => {
    setName("")
    setInstructions("")
  }

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    const id = createProject(name, instructions)
    openProject(id)
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>
            Agrupe conversas relacionadas e defina instruções comuns.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-project-name"
              className="text-sm font-medium text-foreground"
            >
              Nome
            </label>
            <Input
              id="new-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Pesquisa de mercado"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-project-instructions"
              className="text-sm font-medium text-foreground"
            >
              Instruções do projeto
            </label>
            <Textarea
              id="new-project-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="Orientações aplicadas às conversas deste projeto (opcional)."
              className="min-h-[6rem] rounded-lg border border-border bg-background p-3 text-sm focus-visible:border-accent/40"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Criar projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
