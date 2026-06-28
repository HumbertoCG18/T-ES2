import { isValidElement, useRef, type ReactNode } from "react"
import { Check, Copy } from "lucide-react"

import { useCopy } from "@/lib/useCopy"

/** Extrai a linguagem da classe `language-xxx` que o rehype-highlight injeta. */
function getLanguage(children: ReactNode): string | null {
  const child = Array.isArray(children) ? children[0] : children
  if (!isValidElement(child)) return null
  const className = (child.props as { className?: string }).className ?? ""
  const match = /language-([\w+-]+)/.exec(className)
  return match ? match[1] : null
}

/**
 * Renderer de blocos de código (substitui o `<pre>` do Markdown): cabeçalho
 * com a linguagem + botão "Copiar". O texto copiado vem do DOM renderizado,
 * então funciona mesmo com o realce do highlight.js aplicado.
 */
export function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const { copied, copy } = useCopy()
  const language = getLanguage(children)

  return (
    <div className="code-block group my-4 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-foreground/[0.03] px-3 py-1.5">
        <span className="font-mono text-xs font-medium lowercase text-muted-foreground">
          {language ?? "código"}
        </span>
        <button
          type="button"
          onClick={() => copy(preRef.current?.textContent ?? "")}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={copied ? "Código copiado" : "Copiar código"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre ref={preRef} className="m-0 overflow-x-auto px-4 py-3">
        {children}
      </pre>
      <span aria-live="polite" className="sr-only">
        {copied ? "Código copiado para a área de transferência" : ""}
      </span>
    </div>
  )
}
