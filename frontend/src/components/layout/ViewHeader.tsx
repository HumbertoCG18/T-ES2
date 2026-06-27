import type { ReactNode } from "react"
import { Menu, PanelLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"

/**
 * Barra superior padrão das páginas (Conversas, Projetos, Capacidades, …):
 * botão de menu (mobile), expandir a sidebar quando recolhida, e o nome da página.
 * `right` permite ações alinhadas à direita (ex.: seletor de modelo).
 */
export function ViewHeader({
  title,
  collapsed,
  onExpand,
  onOpenMobile,
  right,
}: {
  title: string
  collapsed: boolean
  onExpand: () => void
  onOpenMobile: () => void
  right?: ReactNode
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background/80 px-3 backdrop-blur">
      <Button
        variant="iconGhost"
        className="md:hidden"
        onClick={onOpenMobile}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>
      {collapsed && (
        <Tooltip label="Expandir barra lateral" side="bottom">
          <Button
            variant="iconGhost"
            className="hidden md:inline-flex"
            onClick={onExpand}
            aria-label="Expandir barra lateral"
          >
            <PanelLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Tooltip>
      )}
      <span className="px-2 text-sm font-medium text-foreground">{title}</span>
      {right && <div className="ml-auto">{right}</div>}
    </header>
  )
}
