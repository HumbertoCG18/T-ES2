import { useState } from "react"
import { PanelLeft, Plus, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useStore } from "@/store/store"
import { ConversationList } from "./ConversationList"
import { ProjectList } from "./ProjectList"
import { SidebarFooter } from "./SidebarFooter"

export function Sidebar({
  onClose,
  mobile = false,
}: {
  onClose: () => void
  mobile?: boolean
}) {
  const { newConversation } = useStore()
  const [query, setQuery] = useState("")

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Cabeçalho */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent"
            aria-hidden="true"
          />
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
            Plataforma de Agentes
          </span>
        </div>
        <Tooltip
          label={mobile ? "Fechar" : "Recolher barra lateral"}
          side="bottom"
        >
          <Button
            variant="iconGhost"
            onClick={onClose}
            aria-label={mobile ? "Fechar menu" : "Recolher barra lateral"}
          >
            {mobile ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PanelLeft className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </Tooltip>
      </div>

      {/* Nova conversa */}
      <div className="px-3 pb-2">
        <Button
          onClick={() => newConversation()}
          className="w-full justify-start"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova conversa
        </Button>
      </div>

      {/* Busca */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversas"
            aria-label="Buscar conversas"
            className="h-9 w-full rounded-lg border border-transparent bg-foreground/[0.05] pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-accent/40 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-accent/30"
          />
        </div>
      </div>

      {/* Conteúdo rolável */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 px-3 py-2">
          <ProjectList />
          <ConversationList query={query} />
        </div>
      </ScrollArea>

      <SidebarFooter />
    </div>
  )
}
