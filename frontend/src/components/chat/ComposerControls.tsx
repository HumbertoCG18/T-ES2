import { Brain, ChevronDown, Gauge } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip } from "@/components/ui/tooltip"
import { useHealth } from "@/lib/useHealth"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/store"
import { EFFORTS, MODELS, type Effort, type ModelId } from "@/store/types"

/** Estilo comum das "pílulas" de controle do composer (modelo, esforço, raciocínio). */
const pill =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-foreground/[0.06]"

/**
 * Controles do input do chat (estilo Claude Code): seleção de modelo, nível de esforço e
 * modo raciocínio. Tudo persiste em settings e é enviado ao /chat (ver store.runAgent).
 */
export function ComposerControls() {
  const { state, setModel, updateSettings } = useStore()
  const online = useHealth()
  const { model } = state.settings
  const effort = state.settings.effort ?? "equilibrado"
  const thinking = state.settings.thinking ?? false
  const effortLabel = EFFORTS.find((e) => e.id === effort)?.label ?? "Equilibrado"

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {/* Modelo */}
      <DropdownMenu>
        <DropdownMenuTrigger className={pill} aria-label="Selecionar modelo">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              online ? "bg-success" : online === false ? "bg-destructive" : "bg-muted-foreground/40",
            )}
            aria-hidden="true"
          />
          <span className="font-mono">{model}</span>
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Modelo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={model}
            onValueChange={(v) => setModel(v as ModelId)}
          >
            {MODELS.map((m) => (
              <DropdownMenuRadioItem key={m.id} value={m.id} className="font-mono">
                {m.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Esforço */}
      <DropdownMenu>
        <DropdownMenuTrigger className={pill} aria-label="Selecionar esforço do agente">
          <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
          {effortLabel}
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-[17rem]">
          <DropdownMenuLabel>Esforço do agente</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={effort}
            onValueChange={(v) => updateSettings({ effort: v as Effort })}
          >
            {EFFORTS.map((e) => (
              <DropdownMenuRadioItem
                key={e.id}
                value={e.id}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium text-foreground">{e.label}</span>
                <span className="whitespace-normal text-xs text-muted-foreground">
                  {e.hint}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Raciocínio (thinking) */}
      <Tooltip
        label="Raciocínio passo a passo: o agente mostra os passos antes da resposta"
        side="top"
      >
        <button
          type="button"
          aria-pressed={thinking}
          onClick={() => updateSettings({ thinking: !thinking })}
          className={cn(
            pill,
            thinking &&
              "bg-accent/[0.12] text-accent hover:bg-accent/[0.18] hover:text-accent",
          )}
        >
          <Brain className="h-3.5 w-3.5" aria-hidden="true" />
          Pensar
        </button>
      </Tooltip>
    </div>
  )
}
