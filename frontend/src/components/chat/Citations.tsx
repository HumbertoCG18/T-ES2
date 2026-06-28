import { useState } from "react"
import { ChevronRight, FileText } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Citation } from "@/store/types"

/** Fontes (trechos de documentos) que o RAG injetou como contexto desta resposta. */
export function Citations({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false)
  if (citations.length === 0) return null

  return (
    <div className="mt-3 max-w-prose">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        <FileText className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        Fontes
        <span className="text-muted-foreground/70">· {citations.length}</span>
      </button>

      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {citations.map((c, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-foreground/[0.02] p-2.5 text-xs"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate font-mono">{c.docId || "documento"}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {Math.round(c.score * 100)}%
                </span>
              </div>
              <p className="mt-1 line-clamp-3 text-foreground/80">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
