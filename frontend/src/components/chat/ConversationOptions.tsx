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
import { Skeleton } from "@/components/ui/skeleton"
import { clearMemory, fetchMemory, type MemoryMessage } from "@/lib/api"
import { useStore } from "@/store/store"

/** Opções da conversa ativa: toggles de memória/RAG + ver/limpar memória. */
export function ConversationOptions() {
  const { activeConversation, toggleConversationMemory, toggleConversationRag } = useStore()
  const [memOpen, setMemOpen] = useState(false)
  const [turns, setTurns] = useState<MemoryMessage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [clearError, setClearError] = useState(false)

  if (!activeConversation) return null
  const id = activeConversation.id
  const memOn = activeConversation.useMemory !== false
  const ragOn = activeConversation.useRag !== false

  const openMemory = () => {
    setMemOpen(true)
    setLoading(true)
    setTurns(null)
    setCleared(false)
    fetchMemory(id)
      .then(setTurns)
      .catch(() => setTurns([]))
      .finally(() => setLoading(false))
  }

  const doClear = () => {
    setClearing(true)
    setClearError(false)
    clearMemory(id)
      .then(() => {
        setTurns([])
        setCleared(true)
        setConfirmOpen(false)
      })
      .catch(() => setClearError(true))
      .finally(() => setClearing(false))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opções da conversa"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-foreground/[0.06]"
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
          <DropdownMenuItem danger onSelect={() => setConfirmOpen(true)}>
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
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border p-2.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="mt-1.5 h-3.5 w-full" />
                    <Skeleton className="mt-1 h-3.5 w-3/4" />
                  </div>
                ))}
              </div>
            ) : !turns || turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {cleared
                  ? "Memória limpa."
                  : "Sem memória persistida para esta conversa."}
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
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Limpar memória
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de limpeza (ação destrutiva). */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Limpar memória?</DialogTitle>
            <DialogDescription>
              Os turnos persistidos desta conversa (longo prazo) serão removidos. Esta ação
              não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {clearError && (
            <p className="text-sm text-destructive">
              Não foi possível limpar. Verifique se o memory-service está no ar.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="dangerSolid" onClick={doClear} disabled={clearing}>
              {clearing ? "Limpando…" : "Limpar memória"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
