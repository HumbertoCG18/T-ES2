/** Tipos do domínio da Plataforma de Agentes. */

export type Role = "user" | "assistant"

/** Metadados de um anexo exibidos na bolha da mensagem do usuário. */
export interface Attachment {
  name: string
  size: number
  type: string
}

/**
 * Anexo "em trânsito" no composer: além dos metadados, pode carregar o
 * conteúdo de texto (lido via FileReader) para concatenar à mensagem.
 * O texto NÃO é persistido na mensagem (ver store.sendMessage).
 */
export interface ComposerAttachment extends Attachment {
  text?: string
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  /** Passos do ciclo agêntico (raciocínio → ação → observação). */
  trace?: string[]
  /** Placeholder "pensando" enquanto aguarda a resposta. */
  pending?: boolean
  /** Resposta foi uma mensagem de erro da interface. */
  error?: boolean
  /** Anexos enviados junto da mensagem (apenas metadados; ver TODO). */
  attachments?: Attachment[]
}

export interface Conversation {
  id: string
  title: string
  projectId: string | null
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  /** Conversa fixada nos Favoritos da sidebar. */
  favorite?: boolean
}

/**
 * Arquivo de conhecimento de um projeto. Para arquivos de texto guardamos
 * `text` (truncado ~100KB); para binários, apenas os metadados.
 */
export interface ProjectFile {
  id: string
  name: string
  size: number
  type: string
  text?: string
}

export interface Project {
  id: string
  name: string
  instructions: string
  /** Notas de memória do projeto. TODO: ligar ao memory-service. */
  memory: string[]
  /** Arquivos de conhecimento. TODO: ligar ao retrieval-service (RAG). */
  files: ProjectFile[]
  createdAt: number
  /** Projeto fixado nos Favoritos da sidebar. */
  favorite?: boolean
}

/** Limite de conhecimento por projeto (soma do tamanho dos arquivos), p/ a barra de capacidade. */
export const PROJECT_KNOWLEDGE_LIMIT = 1_000_000 // ~1 MB

/** Preferência de tema; "system" segue prefers-color-scheme. */
export type ThemePref = "light" | "dark" | "system"

/** Modelos disponíveis (cosmético por ora — ver TODO em api.ts). */
export type ModelId = "llama3.1" | "gemma3:4b"

export const MODELS: { id: ModelId; label: string }[] = [
  { id: "llama3.1", label: "llama3.1" },
  { id: "gemma3:4b", label: "gemma3:4b" },
]

export interface Settings {
  theme: ThemePref
  model: ModelId
}

/** Qual conteúdo a área principal exibe. */
export type View =
  | { type: "chat"; conversationId: string | null; draftProjectId: string | null }
  | { type: "project"; projectId: string }
  | { type: "capabilities" }

export interface AppState {
  conversations: Conversation[]
  projects: Project[]
  settings: Settings
  view: View
}
