import { Paperclip } from "lucide-react"

import { formatBytes } from "@/lib/files"
import type { Attachment } from "@/store/types"

/** Lista (somente leitura) dos anexos exibida dentro da bolha do usuário. */
export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((a, i) => (
        <li
          key={i}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2 py-1 text-xs"
        >
          <Paperclip
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="max-w-[12rem] truncate font-medium text-foreground">
            {a.name}
          </span>
          <span className="text-muted-foreground">{formatBytes(a.size)}</span>
        </li>
      ))}
    </ul>
  )
}
