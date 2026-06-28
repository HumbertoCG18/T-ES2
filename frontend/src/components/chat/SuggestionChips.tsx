import { Calculator, Clock, Ruler, Shuffle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { composerBus } from "@/lib/composerBus"

/** Exemplos que exercitam ferramentas reais do agente; clicar preenche o composer. */
const SUGGESTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: Calculator, label: "Calcular", prompt: "Quanto é (12 + 8) × 3?" },
  { icon: Clock, label: "Data e hora", prompt: "Que horas são agora em Tóquio?" },
  { icon: Ruler, label: "Converter", prompt: "Converta 10 km em milhas." },
  { icon: Shuffle, label: "Sortear", prompt: "Sorteie um número inteiro de 1 a 100." },
]

export function SuggestionChips() {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          type="button"
          onClick={() => composerBus.fill(prompt)}
          title={prompt}
          className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-foreground shadow-sm outline-none transition-[color,background-color,box-shadow,transform] hover:border-accent/40 hover:bg-foreground/[0.04] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Icon
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent"
            aria-hidden="true"
          />
          {label}
        </button>
      ))}
    </div>
  )
}
