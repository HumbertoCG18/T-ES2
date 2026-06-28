import { ChevronDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStore } from "@/store/store"
import { MODELS } from "@/store/types"

/**
 * Seletor de modelo — cosmético/local por enquanto.
 * TODO: a API atual (POST /api/chat) não recebe o modelo; integrar quando
 * o backend suportar (ver store.sendMessage / lib/api.ts).
 */
export function ModelSelector() {
  const { state, setModel } = useStore()
  const current = state.settings.model

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Selecionar modelo"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
        {current}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Modelo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODELS.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.id}
            checked={current === m.id}
            onCheckedChange={() => setModel(m.id)}
          >
            {m.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
