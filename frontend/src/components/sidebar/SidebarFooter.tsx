import { Settings } from "lucide-react"

import { SettingsDialog } from "@/components/settings/SettingsDialog"
import { useHealth } from "@/lib/useHealth"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/store"
import { ThemeToggle } from "./ThemeToggle"

export function SidebarFooter() {
  const { state } = useStore()
  const online = useHealth()

  return (
    <div className="border-t border-border p-2">
      <div className="flex items-center gap-1">
        <SettingsDialog>
          <button
            type="button"
            className="flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Settings className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
            Configurações
          </button>
        </SettingsDialog>
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-1.5 px-2.5 pb-0.5 pt-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            online ? "bg-success" : online === false ? "bg-destructive" : "bg-muted-foreground/40",
          )}
          title={
            online
              ? "Plataforma online"
              : online === false
                ? "Plataforma offline"
                : "Verificando…"
          }
          aria-hidden="true"
        />
        Modelo:
        <span className="font-mono text-foreground/80">
          {state.settings.model}
        </span>
      </div>
    </div>
  )
}
