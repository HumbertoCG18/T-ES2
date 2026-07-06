import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { useStore } from "@/store/store"

/**
 * Alterna entre claro e escuro. Se o tema estiver em "system", o primeiro
 * clique fixa explicitamente o oposto do que está sendo exibido.
 */
export function ThemeToggle() {
  const { state, setTheme } = useStore()
  const isDark =
    state.settings.theme === "dark" ||
    (state.settings.theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <Tooltip label={isDark ? "Tema claro" : "Tema escuro"} side="top">
      <Button
        variant="iconGhost"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      >
        {isDark ? (
          <Sun className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
        ) : (
          <Moon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
        )}
      </Button>
    </Tooltip>
  )
}
