import { useState } from "react"
import { Database, Eye, FileSearch, SlidersHorizontal, Trash2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { clearMemory, fetchMemory, type MemoryMessage } from "@/lib/api"
import { useStore } from "@/store/store"

/** Opções da conversa ativa: toggles de memória/RAG + ver/limpar memória. */
export function ConversationOptions() {
  const { activeConversation, toggleConversationMemory, toggleConversationRag } = useStore()
  const [memOpen, setMemOpen] = useState(false)
  const [turns, setTurns] = useState<MemoryMessage[] | null>(null)
  const [loading, setLoading] = useState(false)

  if (!activeConversation) return null
  const id = activeConversation.id
  const memOn = activeConversation.useMemory !== false
  const ragOn = activeConversation.useRag !== false

  const openMemory = () => {
    setMemOpen(true)
    setLoading(true)
    setTurns(null)
    fetchMemory(id)
      .then(setTurns)
      .catch(() => setTurns([]))
      .finally(() => setLoading(false))
  }

  const clear = () => {
    clearMemory(id)
      .then(() => setTurns([]))
      .catch(() => {})
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opções da conversa"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-foreground/[0.06]"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Esta conversa</DropdownMenuLabel>
          {/* preventDefault mantém o menu aberto ao alternar. */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              toggleConversationMemory(id)
            }}
          >
            <Database aria-hidden="true" />
            Memória
            <span className="ml-auto text-xs text-muted-foreground">
              {memOn ? "Ligada" : "Desligada"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              toggleConversationRag(id)
            }}
          >
            <FileSearch aria-hidden="true" />
            RAG (documentos)
            <span className="ml-auto text-xs text-muted-foreground">
              {ragOn ? "Ligado" : "Desligado"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openMemory}>
            <Eye aria-hidden="true" />
            Ver memória
          </DropdownMenuItem>
          <DropdownMenuItem danger onSelect={clear}>
            <Trash2 aria-hidden="true" />
            Limpar memória
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={memOpen} onOpenChange={setMemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Memória da conversa</DialogTitle>
            <DialogDescription>
              Turnos persistidos no longo prazo (PostgreSQL, via memory-service).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : !turns || turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem memória persistida para esta conversa.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {turns.map((t, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-border bg-foreground/[0.02] p-2.5"
                  >
                    <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                      {t.role}
                    </span>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                      {t.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {turns && turns.length > 0 && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                onClick={clear}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Limpar memória
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
