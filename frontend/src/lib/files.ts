import { newId } from "@/lib/id"
import type { ComposerAttachment, ProjectFile } from "@/store/types"

/** Limite de texto guardado por arquivo (localStorage tem ~5MB no total). */
export const MAX_TEXT_BYTES = 100 * 1024

/** Limite de texto concatenado à mensagem enviada ao agente (anexos). */
const MAX_INLINE_TEXT = 8 * 1024

const TEXT_EXTENSIONS = ["txt", "md", "markdown", "csv", "json", "log", "yml", "yaml", "xml", "html", "ts", "tsx", "js", "jsx", "py", "java", "c", "cpp", "go", "rs", "rb", "sh", "css"]

function extension(name: string): string {
  const i = name.lastIndexOf(".")
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ""
}

/** Heurística: o arquivo é texto legível? (PDF e binários ficam só com metadados.) */
export function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true
  if (file.type === "application/json") return true
  return TEXT_EXTENSIONS.includes(extension(file.name))
}

/** Tamanho legível: B / KB / MB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Indica se o texto guardado foi truncado por exceder MAX_TEXT_BYTES. */
export function wasTruncated(file: ProjectFile): boolean {
  return file.text !== undefined && file.size > MAX_TEXT_BYTES
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error("read_error"))
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : ""
      // Trunca para não estourar a cota do localStorage.
      resolve(raw.length > MAX_TEXT_BYTES ? raw.slice(0, MAX_TEXT_BYTES) : raw)
    }
    reader.readAsText(file)
  })
}

/**
 * Lê uma lista de arquivos. Texto vira `text` (truncado); binários ficam só
 * com metadados. Falhas de leitura individuais não derrubam o lote.
 */
export async function readProjectFiles(files: File[]): Promise<ProjectFile[]> {
  const out = await Promise.all(
    files.map(async (file): Promise<ProjectFile> => {
      const base: ProjectFile = {
        id: newId(),
        name: file.name,
        size: file.size,
        type: file.type,
      }
      if (!isTextFile(file)) return base
      try {
        return { ...base, text: await readAsText(file) }
      } catch {
        return base
      }
    }),
  )
  return out
}

/** Lê arquivos como anexos do composer (mesma estratégia de texto/binário). */
export async function readComposerAttachments(
  files: File[],
): Promise<ComposerAttachment[]> {
  return Promise.all(
    files.map(async (file): Promise<ComposerAttachment> => {
      const base: ComposerAttachment = {
        name: file.name,
        size: file.size,
        type: file.type,
      }
      if (!isTextFile(file)) return base
      try {
        return { ...base, text: await readAsText(file) }
      } catch {
        return base
      }
    }),
  )
}

/**
 * Monta o texto enviado ao agente a partir da mensagem + anexos de TEXTO.
 *
 * TODO(entrega-3): o backend (POST /api/chat) só recebe `message` em texto.
 * Aqui concatenamos o conteúdo de anexos pequenos de texto como um paliativo;
 * binários e textos grandes não são enviados. A integração real (upload de
 * arquivos / RAG) liga no retrieval-service.
 */
export function buildAgentText(
  content: string,
  attachments: ComposerAttachment[],
): string {
  const parts = [content]
  for (const a of attachments) {
    if (a.text && a.text.length <= MAX_INLINE_TEXT) {
      parts.push(`\n\nArquivo anexado: ${a.name}\n${a.text}`)
    }
  }
  return parts.join("").trim()
}
