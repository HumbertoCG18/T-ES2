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

/** Trecho de documento usado pelo RAG (fonte da resposta). */
export interface Citation {
  text: string
  score: number
  docId: string
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  /** Passos do ciclo agêntico (raciocínio → ação → observação). */
  trace?: string[]
  /** Trechos de documentos (RAG) usados como contexto desta resposta. */
  citations?: Citation[]
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
  /** Toggle de memória por conversa (undefined = ligado). */
  useMemory?: boolean
  /** Toggle de RAG por conversa (undefined = ligado). */
  useRag?: boolean
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

/** Limite de conhecimento por projeto (soma do tamanho dos arquivos), p/ a barra de capacidade.
 *  Binários guardam só metadados e texto é truncado, então o limite pode ser generoso. */
export const PROJECT_KNOWLEDGE_LIMIT = 30_000_000 // ~28.6 MB

/** Preferência de tema; "system" segue prefers-color-scheme. */
export type ThemePref = "light" | "dark" | "system"

/** Modelos disponíveis no seletor do composer. */
export type ModelId = "llama3.1" | "llama3.2:3b" | "gemma3:4b"

export const MODELS: { id: ModelId; label: string }[] = [
  { id: "llama3.1", label: "llama3.1" },
  { id: "llama3.2:3b", label: "llama3.2:3b (rápido)" },
  { id: "gemma3:4b", label: "gemma3:4b" },
]

/** Mapa do modelo (UI) → nome lógico no llm-gateway (config.yaml do LiteLLM). */
export const MODEL_TO_GATEWAY: Record<ModelId, string> = {
  "llama3.1": "chat",
  "llama3.2:3b": "chat-fast",
  "gemma3:4b": "chat-light",
}

/** Entrada do catálogo curado de modelos do Ollama (para baixar nas Configurações). */
export interface OllamaCatalogEntry {
  /** Tag exata para `ollama pull` (ex.: "llama3.1", "gemma3:4b"). */
  name: string
  label: string
  /** Tamanho aproximado do download. */
  size: string
  description: string
  /** Rótulo curto de destaque (ex.: "ferramentas", "leve", "embeddings"). */
  tag?: string
}

/**
 * Catálogo curado de modelos populares (o ollama.com/search não tem API pública — para o resto,
 * use o campo de busca por nome ou o link "ver catálogo completo"). Os modelos de `MODELS` e o de
 * embeddings do RAG estão aqui.
 */
export const OLLAMA_CATALOG: OllamaCatalogEntry[] = [
  {
    name: "llama3.1",
    label: "Llama 3.1 8B",
    size: "~4.9 GB",
    description: "Padrão da plataforma; tool calling confiável.",
    tag: "ferramentas",
  },
  {
    name: "llama3.2:3b",
    label: "Llama 3.2 3B",
    size: "~2.0 GB",
    description: "Mais leve e rápido; bom em máquinas modestas.",
    tag: "leve",
  },
  {
    name: "gemma3:4b",
    label: "Gemma 3 4B",
    size: "~3.3 GB",
    description: "Alternativa leve (cabe em ~4 GB de VRAM).",
    tag: "leve",
  },
  {
    name: "qwen2.5:7b",
    label: "Qwen 2.5 7B",
    size: "~4.7 GB",
    description: "Forte em raciocínio e tool calling.",
    tag: "ferramentas",
  },
  {
    name: "phi3.5",
    label: "Phi 3.5",
    size: "~2.2 GB",
    description: "Pequeno e capaz; ótimo custo/qualidade.",
    tag: "leve",
  },
  {
    name: "mistral",
    label: "Mistral 7B",
    size: "~4.1 GB",
    description: "Generalista popular.",
  },
  {
    name: "embeddinggemma:300m",
    label: "EmbeddingGemma 300M",
    size: "~620 MB",
    description: "Embeddings do RAG (retrieval-service). Necessário p/ busca semântica.",
    tag: "embeddings",
  },
]

/**
 * Nível de esforço do agente: orçamento de iterações do ciclo agêntico + temperatura.
 * Enviado ao /chat e mapeado no agent-service (AgentLoop.effortPolicy).
 */
export type Effort = "rapido" | "equilibrado" | "profundo"

export const EFFORTS: { id: Effort; label: string; hint: string }[] = [
  { id: "rapido", label: "Rápido", hint: "Poucas iterações; resposta direta." },
  {
    id: "equilibrado",
    label: "Equilibrado",
    hint: "Padrão: equilíbrio entre velocidade e profundidade.",
  },
  {
    id: "profundo",
    label: "Profundo",
    hint: "Mais iterações do ciclo agêntico — raciocina e usa ferramentas com mais afinco.",
  },
]

/** Fonte da interface. */
export type FontPref = "sans" | "serif" | "mono"

/** Estilo de resposta preferido (cosmético até o backend aceitar). */
export type ResponseStyle = "normal" | "conciso" | "detalhado"

export interface Settings {
  theme: ThemePref
  model: ModelId
  /** Nível de esforço do agente (orçamento de iterações + temperatura). */
  effort?: Effort
  /** Modo raciocínio: pede passos de raciocínio antes da resposta final. */
  thinking?: boolean
  /** Fonte da interface (aplicada via [data-font] no <html>). */
  font?: FontPref
  /** Estilo de resposta preferido. */
  responseStyle?: ResponseStyle
  /** Instruções gerais para a LLM. */
  instructions?: string
  /** Como a LLM pode te chamar. */
  nickname?: string
}

export const FONT_OPTIONS: { value: FontPref; label: string }[] = [
  { value: "sans", label: "Padrão" },
  { value: "serif", label: "Serifada" },
  { value: "mono", label: "Monoespaçada" },
]

export const RESPONSE_STYLES: { value: ResponseStyle; label: string }[] = [
  { value: "normal", label: "Equilibrada" },
  { value: "conciso", label: "Concisa" },
  { value: "detalhado", label: "Detalhada" },
]

/** Qual conteúdo a área principal exibe. */
export type View =
  | { type: "chat"; conversationId: string | null; draftProjectId: string | null }
  | { type: "project"; projectId: string }
  | { type: "capabilities" }
  | { type: "recents" }
  | { type: "projectsList" }

export interface AppState {
  conversations: Conversation[]
  projects: Project[]
  settings: Settings
  view: View
}
