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

/** Heurística: o arquivo é texto legível? (binários ficam só com metadados; PDF tem extração própria.) */
export function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true
  if (file.type === "application/json") return true
  return TEXT_EXTENSIONS.includes(extension(file.name))
}

/** O arquivo é um PDF? (texto extraível via pdfjs — ver extractPdfText.) */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || extension(file.name) === "pdf"
}

/**
 * Extrai o texto de um PDF no navegador (pdfjs-dist). Import dinâmico: a lib (~1MB) só é
 * baixada quando o usuário de fato anexa um PDF. PDFs escaneados (só imagem) retornam texto
 * vazio — o chamador trata como binário não-indexável.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist")
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const doc = await task.promise
  try {
    const parts: string[] = []
    let total = 0
    for (let i = 1; i <= doc.numPages && total < MAX_TEXT_BYTES; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
      if (pageText) {
        parts.push(pageText)
        total += pageText.length
      }
    }
    const text = parts.join("\n\n")
    // Trunca para não estourar a cota do localStorage (mesma regra dos arquivos de texto).
    return text.length > MAX_TEXT_BYTES ? text.slice(0, MAX_TEXT_BYTES) : text
  } finally {
    void task.destroy()
  }
}

/** Tamanho legível: B / KB / MB / GB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
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

/** Extrai o conteúdo de texto do arquivo: texto direto, PDF via pdfjs, binário = undefined. */
async function readFileText(file: File): Promise<string | undefined> {
  try {
    if (isTextFile(file)) return await readAsText(file)
    if (isPdfFile(file)) {
      const text = await extractPdfText(file)
      // PDF escaneado (só imagem) não tem texto extraível → tratar como binário.
      return text.trim() ? text : undefined
    }
  } catch (err) {
    // Falha de leitura individual não derruba o lote — fica só com metadados.
    // Logar: falha silenciosa aqui já mascarou um bug real (worker do pdfjs com MIME errado).
    console.warn(`[files] Falha ao extrair texto de "${file.name}":`, err)
  }
  return undefined
}

/**
 * Lê uma lista de arquivos. Texto (e PDF com texto) vira `text` (truncado);
 * binários ficam só com metadados. Falhas individuais não derrubam o lote.
 */
export async function readProjectFiles(files: File[]): Promise<ProjectFile[]> {
  return Promise.all(
    files.map(async (file): Promise<ProjectFile> => {
      const base: ProjectFile = {
        id: newId(),
        name: file.name,
        size: file.size,
        type: file.type,
      }
      const text = await readFileText(file)
      return text !== undefined ? { ...base, text } : base
    }),
  )
}

/** Lê arquivos como anexos do composer (mesma estratégia: texto/PDF/binário). */
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
      const text = await readFileText(file)
      return text !== undefined ? { ...base, text } : base
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
