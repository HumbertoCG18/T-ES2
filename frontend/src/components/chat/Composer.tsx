import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react"
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/ui/tooltip"
import { composerBus } from "@/lib/composerBus"
import { formatBytes, readComposerAttachments } from "@/lib/files"
import { quoteBus } from "@/lib/quoteBus"
import type { ComposerAttachment } from "@/store/types"

interface ComposerProps {
  onSend: (text: string, attachments: ComposerAttachment[]) => void
  disabled?: boolean
  autoFocus?: boolean
}

const MAX_HEIGHT = 220

export function Composer({ onSend, disabled, autoFocus }: ComposerProps) {
  const [value, setValue] = useState("")
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-crescimento da textarea conforme o conteúdo.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  // Chips de sugestão (tela inicial): substituem o texto e focam, cursor ao fim.
  useEffect(() => {
    return composerBus.subscribe((text) => {
      setValue(text)
      const el = textareaRef.current
      if (el) {
        el.focus()
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = el.value.length
        })
      }
    })
  }, [])

  // "Citar trecho": insere o texto selecionado como citação Markdown e foca o composer.
  useEffect(() => {
    return quoteBus.subscribe((quote) => {
      const block = quote
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
      setValue((v) => (v.trim() ? `${v}\n\n` : "") + `${block}\n\n`)
      textareaRef.current?.focus()
    })
  }, [])

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    // Permite reanexar o mesmo arquivo depois.
    e.target.value = ""
    if (files.length === 0) return
    try {
      const read = await readComposerAttachments(files)
      setAttachments((prev) => [...prev, ...read])
    } catch {
      // Anexa ao menos os metadados se a leitura de texto falhar.
      setAttachments((prev) => [
        ...prev,
        ...files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      ])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = () => {
    const text = value.trim()
    if ((!text && attachments.length === 0) || disabled) return
    onSend(text, attachments)
    setValue("")
    setAttachments([])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia, Shift+Enter quebra linha.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm transition-colors focus-within:border-accent/40 focus-within:shadow-md">
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-b border-border px-3 pb-2 pt-2.5">
          {attachments.map((a, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs"
            >
              <Paperclip
                className="h-3 w-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="max-w-[12rem] truncate font-medium text-foreground">
                {a.name}
              </span>
              <span className="text-muted-foreground">{formatBytes(a.size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                aria-label={`Remover anexo ${a.name}`}
                className="ml-0.5 rounded p-0.5 text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 px-3 py-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFiles}
          aria-hidden="true"
          tabIndex={-1}
        />
        <Tooltip label="Anexar arquivo" side="top">
          <Button
            variant="iconGhost"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            aria-label="Anexar arquivo"
            className="mb-0.5 shrink-0"
          >
            <Paperclip className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Tooltip>

        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte qualquer coisa…"
          aria-label="Mensagem"
          className="max-h-[220px] py-2"
        />
        <Button
          variant="icon"
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={disabled ? "Gerando resposta" : "Enviar mensagem"}
          className={`shrink-0 ${disabled ? "disabled:bg-accent/50 disabled:opacity-100" : ""}`}
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  )
}
