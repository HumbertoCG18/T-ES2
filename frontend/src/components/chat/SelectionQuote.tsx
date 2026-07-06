import { useEffect, useState } from "react"
import { Quote } from "lucide-react"

import { quoteBus } from "@/lib/quoteBus"

interface QuotePos {
  x: number
  y: number
  text: string
}

/**
 * Mostra um botão flutuante "Citar" quando o usuário seleciona texto dentro de uma resposta
 * do agente (`[data-quotable]`). Ao clicar, emite o trecho para o Composer (via quoteBus).
 */
export function SelectionQuote() {
  const [pos, setPos] = useState<QuotePos | null>(null)

  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        setPos(null)
        return
      }
      const text = sel.toString().trim()
      if (!text) {
        setPos(null)
        return
      }
      const node = sel.anchorNode
      const el = node instanceof Element ? node : node?.parentElement
      if (!el || !el.closest("[data-quotable]")) {
        setPos(null)
        return
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      setPos({ x: rect.left + rect.width / 2, y: rect.top, text })
    }

    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) setPos(null)
    }

    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("selectionchange", onSelectionChange)
    return () => {
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("selectionchange", onSelectionChange)
    }
  }, [])

  if (!pos) return null

  return (
    <button
      type="button"
      // Não limpar a seleção antes do clique disparar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        quoteBus.emit(pos.text)
        window.getSelection()?.removeAllRanges()
        setPos(null)
      }}
      style={{
        position: "fixed",
        left: pos.x,
        top: Math.max(8, pos.y - 42),
        transform: "translateX(-50%)",
      }}
      className="z-50 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Quote className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
      Citar trecho
    </button>
  )
}
