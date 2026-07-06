import { memo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"

import { cn } from "@/lib/utils"
import { CodeBlock } from "./CodeBlock"

/**
 * Renderiza a resposta do agente como Markdown rico:
 * - GFM (tabelas, listas de tarefas, etc.)
 * - LaTeX via KaTeX ($inline$ e $$bloco$$)
 * - realce de código (highlight.js) com cabeçalho + botão copiar (CodeBlock)
 *
 * A estilização base fica na classe .prose-chat (ver index.css); o tema do
 * KaTeX/highlight usa as variáveis da paleta (claro/escuro).
 */
const components: Components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener" />
  ),
  pre: ({ node: _node, children }) => <CodeBlock>{children}</CodeBlock>,
}

function MarkdownImpl({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn("prose-chat", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownImpl)
