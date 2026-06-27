import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Hook de "copiar para a área de transferência" com feedback temporário.
 * Usa a Clipboard API e cai para um fallback com <textarea> + execCommand.
 */
export function useCopy(resetMs = 1600) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(
    async (text: string) => {
      let ok = false
      try {
        await navigator.clipboard.writeText(text)
        ok = true
      } catch {
        try {
          const ta = document.createElement("textarea")
          ta.value = text
          ta.style.position = "fixed"
          ta.style.left = "-9999px"
          ta.setAttribute("readonly", "")
          document.body.appendChild(ta)
          ta.select()
          ok = document.execCommand("copy")
          document.body.removeChild(ta)
        } catch {
          ok = false
        }
      }
      if (!ok) return
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), resetMs)
    },
    [resetMs],
  )

  return { copied, copy }
}
