import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"
import {
  AlertTriangle,
  File,
  FileImage,
  FileText,
  Trash2,
  Upload,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { ingestDocument } from "@/lib/api"
import { formatBytes, readProjectFiles, wasTruncated } from "@/lib/files"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { useStore } from "@/store/store"
import { PROJECT_KNOWLEDGE_LIMIT, type Project, type ProjectFile } from "@/store/types"

function iconFor(file: ProjectFile): LucideIcon {
  if (file.type.startsWith("image/")) return FileImage
  if (file.text !== undefined) return FileText
  return File
}

export function ProjectFiles({ project }: { project: Project }) {
  const { addProjectFiles, removeProjectFile, storageError } = useStore()
  const [dragging, setDragging] = useState(false)
  const [ragNote, setRagNote] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  const ingest = async (files: File[]) => {
    if (files.length === 0) return
    const read = await readProjectFiles(files)
    addProjectFiles(project.id, read)

    // Envia o texto para o RAG (assíncrono). Só arquivos de texto têm conteúdo indexável.
    const textFiles = read.filter((f) => f.text && f.text.trim())
    if (textFiles.length === 0) return
    setRagNote("Enviando para indexação…")
    let ok = 0
    await Promise.all(
      textFiles.map((f) =>
        ingestDocument(f.id, project.id, f.text as string)
          .then(() => {
            ok += 1
          })
          .catch(() => {}),
      ),
    )
    setRagNote(
      ok === textFiles.length
        ? `${ok} arquivo(s) enviados para indexação (RAG).`
        : `${ok}/${textFiles.length} indexados — verifique o retrieval-service/RabbitMQ.`,
    )
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ""
    void ingest(files)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : []
    void ingest(files)
  }

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) setDragging(false)
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">
          Arquivos{" "}
          <span className="font-normal text-muted-foreground">(conhecimento)</span>
        </h3>
      </div>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Documentos de referência do projeto. Texto é indexado localmente;
        binários guardam apenas os metadados.
      </p>

      {project.files.length > 0 &&
        (() => {
          const used = project.files.reduce((s, f) => s + f.size, 0)
          const pct = (used / PROJECT_KNOWLEDGE_LIMIT) * 100
          const warn = pct >= 85
          return (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Capacidade do conhecimento</span>
                <span className={cn("tabular-nums", warn ? "text-warning" : "text-muted-foreground")}>
                  {Math.round(pct)}% · {formatBytes(used)} / {formatBytes(PROJECT_KNOWLEDGE_LIMIT)}
                </span>
              </div>
              <Progress value={pct} tone={warn ? "warning" : "accent"} />
            </div>
          )
        })()}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label="Enviar arquivos: clique ou arraste e solte"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
          dragging
            ? "border-accent/60 bg-accent/[0.06]"
            : "border-border hover:border-accent/40 hover:bg-foreground/[0.02]",
        )}
      >
        <Upload
          className={cn(
            "h-5 w-5 transition-colors",
            dragging ? "text-accent" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">
          Arraste arquivos aqui ou clique para enviar
        </p>
        <p className="text-xs text-muted-foreground">
          .txt, .md, .csv, .json e outros — vários de uma vez
        </p>
      </div>

      {storageError && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Não foi possível salvar tudo no navegador (limite de armazenamento).
          Remova alguns arquivos para liberar espaço.
        </p>
      )}

      {ragNote && (
        <p className="mt-3 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2 text-xs text-muted-foreground">
          {ragNote}
        </p>
      )}

      {project.files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {project.files.map((file) => {
            const Icon = iconFor(file)
            const truncated = wasTruncated(file)
            return (
              <li
                key={file.id}
                className="group flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                    {!isTextFileType(file) && " · binário (só metadados)"}
                    {truncated && " · texto truncado"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeProjectFile(project.id, file.id)}
                  aria-label={`Remover ${file.name}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground opacity-100 outline-none transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Um arquivo guardado é "texto" quando carregamos seu conteúdo. */
function isTextFileType(file: ProjectFile): boolean {
  return file.text !== undefined
}
