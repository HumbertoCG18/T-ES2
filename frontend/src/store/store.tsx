import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { sendChat } from "@/lib/api"
import { buildAgentText } from "@/lib/files"
import { newId } from "@/lib/id"
import type {
  AppState,
  ChatMessage,
  ComposerAttachment,
  Conversation,
  ModelId,
  Project,
  ProjectFile,
  Settings,
  ThemePref,
  View,
} from "./types"

const STORAGE_KEY = "plataforma-agentes/v1"

const NETWORK_ERROR =
  "Não consegui falar com a plataforma. Confirme que os serviços estão no ar (porta 8080)."

const DEFAULT_STATE: AppState = {
  conversations: [],
  projects: [],
  settings: { theme: "system", model: "llama3.1" },
  view: { type: "chat", conversationId: null, draftProjectId: null },
}

/** Deriva um título a partir das primeiras palavras da 1ª mensagem. */
function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= 48) return clean || "Nova conversa"
  return clean.slice(0, 48).trimEnd() + "…"
}

// ---------- Ações ----------

type Action =
  | { type: "SET_VIEW"; view: View }
  | { type: "CREATE_CONVERSATION"; conversation: Conversation }
  | { type: "ADD_MESSAGES"; conversationId: string; messages: ChatMessage[] }
  | { type: "SET_MESSAGES"; conversationId: string; messages: ChatMessage[] }
  | {
      type: "RESOLVE_MESSAGE"
      conversationId: string
      messageId: string
      content: string
      trace?: string[]
      error?: boolean
    }
  | { type: "RENAME_CONVERSATION"; id: string; title: string }
  | { type: "DELETE_CONVERSATION"; id: string }
  | { type: "MOVE_CONVERSATION"; id: string; projectId: string | null }
  | { type: "CREATE_PROJECT"; project: Project }
  | {
      type: "UPDATE_PROJECT"
      id: string
      patch: Partial<Pick<Project, "name" | "instructions">>
    }
  | { type: "ADD_PROJECT_MEMORY"; id: string; note: string }
  | { type: "REMOVE_PROJECT_MEMORY"; id: string; index: number }
  | { type: "ADD_PROJECT_FILES"; id: string; files: ProjectFile[] }
  | { type: "REMOVE_PROJECT_FILE"; id: string; fileId: string }
  | { type: "DELETE_PROJECT"; id: string }
  | { type: "SET_THEME"; theme: ThemePref }
  | { type: "SET_MODEL"; model: ModelId }

function touch(conv: Conversation): Conversation {
  return { ...conv, updatedAt: Date.now() }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view }

    case "CREATE_CONVERSATION":
      return {
        ...state,
        conversations: [action.conversation, ...state.conversations],
        view: {
          type: "chat",
          conversationId: action.conversation.id,
          draftProjectId: null,
        },
      }

    case "ADD_MESSAGES":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? touch({ ...c, messages: [...c.messages, ...action.messages] })
            : c,
        ),
      }

    case "SET_MESSAGES":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? touch({ ...c, messages: action.messages })
            : c,
        ),
      }

    case "RESOLVE_MESSAGE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? touch({
                ...c,
                messages: c.messages.map((m) =>
                  m.id === action.messageId
                    ? {
                        ...m,
                        content: action.content,
                        trace: action.trace,
                        error: action.error,
                        pending: false,
                      }
                    : m,
                ),
              })
            : c,
        ),
      }

    case "RENAME_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.id ? { ...c, title: action.title } : c,
        ),
      }

    case "DELETE_CONVERSATION": {
      const conversations = state.conversations.filter(
        (c) => c.id !== action.id,
      )
      const wasActive =
        state.view.type === "chat" && state.view.conversationId === action.id
      return {
        ...state,
        conversations,
        view: wasActive
          ? { type: "chat", conversationId: null, draftProjectId: null }
          : state.view,
      }
    }

    case "MOVE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.id ? { ...c, projectId: action.projectId } : c,
        ),
      }

    case "CREATE_PROJECT":
      return { ...state, projects: [action.project, ...state.projects] }

    case "UPDATE_PROJECT":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
      }

    case "ADD_PROJECT_MEMORY":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id
            ? { ...p, memory: [...p.memory, action.note] }
            : p,
        ),
      }

    case "REMOVE_PROJECT_MEMORY":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id
            ? { ...p, memory: p.memory.filter((_, i) => i !== action.index) }
            : p,
        ),
      }

    case "ADD_PROJECT_FILES":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id
            ? { ...p, files: [...p.files, ...action.files] }
            : p,
        ),
      }

    case "REMOVE_PROJECT_FILE":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id
            ? { ...p, files: p.files.filter((f) => f.id !== action.fileId) }
            : p,
        ),
      }

    case "DELETE_PROJECT": {
      const projects = state.projects.filter((p) => p.id !== action.id)
      const conversations = state.conversations.map((c) =>
        c.projectId === action.id ? { ...c, projectId: null } : c,
      )
      const viewingDeleted =
        state.view.type === "project" && state.view.projectId === action.id
      return {
        ...state,
        projects,
        conversations,
        view: viewingDeleted
          ? { type: "chat", conversationId: null, draftProjectId: null }
          : state.view,
      }
    }

    case "SET_THEME":
      return { ...state, settings: { ...state.settings, theme: action.theme } }

    case "SET_MODEL":
      return { ...state, settings: { ...state.settings, model: action.model } }

    default:
      return state
  }
}

// ---------- Persistência ----------

function sanitize(raw: unknown): AppState {
  if (!raw || typeof raw !== "object") return DEFAULT_STATE
  const data = raw as Partial<AppState>

  const conversations: Conversation[] = Array.isArray(data.conversations)
    ? data.conversations.map((c) => ({
        id: String(c.id ?? newId()),
        title: c.title || "Nova conversa",
        projectId: c.projectId ?? null,
        // Remove placeholders "pensando" que ficaram pendentes ao recarregar.
        messages: Array.isArray(c.messages)
          ? c.messages.filter((m) => !(m.pending && !m.content))
          : [],
        createdAt: c.createdAt ?? Date.now(),
        updatedAt: c.updatedAt ?? Date.now(),
      }))
    : []

  const projects: Project[] = Array.isArray(data.projects)
    ? data.projects.map((p) => ({
        id: String(p.id ?? newId()),
        name: p.name || "Projeto",
        instructions: p.instructions ?? "",
        memory: Array.isArray(p.memory)
          ? p.memory.filter((m): m is string => typeof m === "string")
          : [],
        files: Array.isArray(p.files)
          ? p.files.map((f): ProjectFile => ({
              id: String(f?.id ?? newId()),
              name: String(f?.name ?? "arquivo"),
              size: Number(f?.size ?? 0),
              type: String(f?.type ?? ""),
              text: typeof f?.text === "string" ? f.text : undefined,
            }))
          : [],
        createdAt: p.createdAt ?? Date.now(),
      }))
    : []

  const settings: Settings = {
    theme: data.settings?.theme ?? "system",
    model: data.settings?.model ?? "llama3.1",
  }

  // Valida a view persistida.
  let view: View = { type: "chat", conversationId: null, draftProjectId: null }
  const v = data.view
  if (v?.type === "project" && projects.some((p) => p.id === v.projectId)) {
    view = { type: "project", projectId: v.projectId }
  } else if (v?.type === "chat" && v.conversationId) {
    view = conversations.some((c) => c.id === v.conversationId)
      ? { type: "chat", conversationId: v.conversationId, draftProjectId: null }
      : { type: "chat", conversationId: null, draftProjectId: null }
  }

  return { conversations, projects, settings, view }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return sanitize(JSON.parse(raw))
  } catch {
    return DEFAULT_STATE
  }
}

// ---------- Contexto ----------

interface StoreValue {
  state: AppState
  activeConversation: Conversation | null
  activeProject: Project | null
  isLoading: boolean
  /** Falha ao persistir no localStorage (ex.: cota cheia). */
  storageError: boolean
  newConversation: (projectId?: string | null) => void
  selectConversation: (id: string) => void
  openProject: (id: string) => void
  showCapabilities: () => void
  sendMessage: (text: string, attachments?: ComposerAttachment[]) => void
  editAndResend: (convId: string, messageIndex: number, newContent: string) => void
  regenerateLast: (convId: string) => void
  renameConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  moveConversation: (id: string, projectId: string | null) => void
  createProject: (name: string, instructions: string) => string
  updateProject: (
    id: string,
    patch: Partial<Pick<Project, "name" | "instructions">>,
  ) => void
  addProjectMemory: (id: string, note: string) => void
  removeProjectMemory: (id: string, index: number) => void
  addProjectFiles: (id: string, files: ProjectFile[]) => void
  removeProjectFile: (id: string, fileId: string) => void
  deleteProject: (id: string) => void
  setTheme: (theme: ThemePref) => void
  setModel: (model: ModelId) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  // Ref com o estado mais recente para evitar closures obsoletas no envio.
  const stateRef = useRef(state)
  stateRef.current = state

  // Sinaliza falha ao persistir (ex.: cota do localStorage estourada).
  const [storageError, setStorageError] = useState(false)

  // Persiste em localStorage a cada mudança. Não quebra a app se a cota
  // estourar (arquivos de conhecimento podem ser grandes) — apenas avisa.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      setStorageError((prev) => (prev ? false : prev))
    } catch {
      setStorageError((prev) => (prev ? prev : true))
    }
  }, [state])

  // Aplica o tema (.dark no <html>) e segue o sistema quando "system".
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      const dark =
        state.settings.theme === "dark" ||
        (state.settings.theme === "system" && mq.matches)
      root.classList.toggle("dark", dark)
    }
    apply()
    if (state.settings.theme === "system") {
      mq.addEventListener("change", apply)
      return () => mq.removeEventListener("change", apply)
    }
  }, [state.settings.theme])

  // Habilita transições de tema só após a 1ª pintura (evita "flash").
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      document.documentElement.classList.add("theme-anim"),
    )
    return () => cancelAnimationFrame(id)
  }, [])

  const newConversation = useCallback((projectId: string | null = null) => {
    dispatch({
      type: "SET_VIEW",
      view: { type: "chat", conversationId: null, draftProjectId: projectId },
    })
  }, [])

  const selectConversation = useCallback((id: string) => {
    dispatch({
      type: "SET_VIEW",
      view: { type: "chat", conversationId: id, draftProjectId: null },
    })
  }, [])

  const openProject = useCallback((id: string) => {
    dispatch({ type: "SET_VIEW", view: { type: "project", projectId: id } })
  }, [])

  const showCapabilities = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: { type: "capabilities" } })
  }, [])

  /**
   * Dispara a chamada ao agente e resolve o placeholder "pensando".
   *
   * O `conversationId` da conversa ativa é enviado para ativar memória/RAG por
   * conversa (Entrega 3). TODO: a API ainda não recebe o modelo selecionado
   * (cosmético) nem os anexos/instruções/memória do projeto; quando o backend
   * suportar, enviar esses dados junto da mensagem.
   */
  const runAgent = useCallback(
    (conversationId: string, apiText: string, pendingId: string) => {
      sendChat(apiText, conversationId)
        .then(({ reply, trace }) => {
          dispatch({
            type: "RESOLVE_MESSAGE",
            conversationId,
            messageId: pendingId,
            content: reply,
            trace,
          })
        })
        .catch(() => {
          dispatch({
            type: "RESOLVE_MESSAGE",
            conversationId,
            messageId: pendingId,
            content: NETWORK_ERROR,
            error: true,
          })
        })
    },
    [],
  )

  const sendMessage = useCallback(
    (text: string, attachments: ComposerAttachment[] = []) => {
      const content = text.trim()
      if (!content && attachments.length === 0) return
      const s = stateRef.current
      if (s.view.type !== "chat") return

      let conversationId = s.view.conversationId
      if (conversationId == null) {
        conversationId = newId()
        const conv: Conversation = {
          id: conversationId,
          title: deriveTitle(content || attachments[0]?.name || ""),
          projectId: s.view.draftProjectId,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        dispatch({ type: "CREATE_CONVERSATION", conversation: conv })
      }

      // Guarda apenas os metadados do anexo na mensagem (texto não persiste).
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content,
        attachments: attachments.length
          ? attachments.map(({ name, size, type }) => ({ name, size, type }))
          : undefined,
      }
      const pendingId = newId()
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        pending: true,
      }
      dispatch({
        type: "ADD_MESSAGES",
        conversationId,
        messages: [userMsg, pendingMsg],
      })

      runAgent(conversationId, buildAgentText(content, attachments), pendingId)
    },
    [runAgent],
  )

  /**
   * Edita uma mensagem do usuário, TRUNCA tudo a partir dela e reenvia,
   * gerando uma nova resposta do agente.
   */
  const editAndResend = useCallback(
    (convId: string, messageIndex: number, newContent: string) => {
      const content = newContent.trim()
      if (!content) return
      const conv = stateRef.current.conversations.find((c) => c.id === convId)
      if (!conv) return
      const target = conv.messages[messageIndex]
      if (!target || target.role !== "user") return

      const editedUser: ChatMessage = { ...target, content }
      const pendingId = newId()
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        pending: true,
      }
      dispatch({
        type: "SET_MESSAGES",
        conversationId: convId,
        messages: [...conv.messages.slice(0, messageIndex), editedUser, pendingMsg],
      })
      runAgent(convId, content, pendingId)
    },
    [runAgent],
  )

  /** Remove a última resposta do assistente e reenvia a última do usuário. */
  const regenerateLast = useCallback(
    (convId: string) => {
      const conv = stateRef.current.conversations.find((c) => c.id === convId)
      if (!conv) return
      let lastUserIdx = -1
      for (let i = conv.messages.length - 1; i >= 0; i--) {
        if (conv.messages[i].role === "user") {
          lastUserIdx = i
          break
        }
      }
      if (lastUserIdx === -1) return
      const userMsg = conv.messages[lastUserIdx]

      const pendingId = newId()
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        pending: true,
      }
      dispatch({
        type: "SET_MESSAGES",
        conversationId: convId,
        messages: [...conv.messages.slice(0, lastUserIdx + 1), pendingMsg],
      })
      runAgent(convId, userMsg.content, pendingId)
    },
    [runAgent],
  )

  const renameConversation = useCallback((id: string, title: string) => {
    const clean = title.trim()
    if (!clean) return
    dispatch({ type: "RENAME_CONVERSATION", id, title: clean })
  }, [])

  const deleteConversation = useCallback((id: string) => {
    dispatch({ type: "DELETE_CONVERSATION", id })
  }, [])

  const moveConversation = useCallback(
    (id: string, projectId: string | null) => {
      dispatch({ type: "MOVE_CONVERSATION", id, projectId })
    },
    [],
  )

  const createProject = useCallback((name: string, instructions: string) => {
    const id = newId()
    const project: Project = {
      id,
      name: name.trim() || "Projeto sem título",
      instructions: instructions.trim(),
      memory: [],
      files: [],
      createdAt: Date.now(),
    }
    dispatch({ type: "CREATE_PROJECT", project })
    return id
  }, [])

  const updateProject = useCallback(
    (id: string, patch: Partial<Pick<Project, "name" | "instructions">>) => {
      dispatch({ type: "UPDATE_PROJECT", id, patch })
    },
    [],
  )

  const addProjectMemory = useCallback((id: string, note: string) => {
    const clean = note.trim()
    if (!clean) return
    dispatch({ type: "ADD_PROJECT_MEMORY", id, note: clean })
  }, [])

  const removeProjectMemory = useCallback((id: string, index: number) => {
    dispatch({ type: "REMOVE_PROJECT_MEMORY", id, index })
  }, [])

  const addProjectFiles = useCallback((id: string, files: ProjectFile[]) => {
    if (files.length === 0) return
    dispatch({ type: "ADD_PROJECT_FILES", id, files })
  }, [])

  const removeProjectFile = useCallback((id: string, fileId: string) => {
    dispatch({ type: "REMOVE_PROJECT_FILE", id, fileId })
  }, [])

  const deleteProject = useCallback((id: string) => {
    dispatch({ type: "DELETE_PROJECT", id })
  }, [])

  const setTheme = useCallback((theme: ThemePref) => {
    dispatch({ type: "SET_THEME", theme })
  }, [])

  const setModel = useCallback((model: ModelId) => {
    dispatch({ type: "SET_MODEL", model })
  }, [])

  const activeConversation = useMemo(() => {
    if (state.view.type !== "chat") return null
    const id = state.view.conversationId
    if (!id) return null
    return state.conversations.find((c) => c.id === id) ?? null
  }, [state.view, state.conversations])

  const activeProject = useMemo(() => {
    if (state.view.type !== "project") return null
    const pid = state.view.projectId
    return state.projects.find((p) => p.id === pid) ?? null
  }, [state.view, state.projects])

  const isLoading = useMemo(() => {
    const last = activeConversation?.messages.at(-1)
    return Boolean(last?.pending)
  }, [activeConversation])

  const value = useMemo<StoreValue>(
    () => ({
      state,
      activeConversation,
      activeProject,
      isLoading,
      storageError,
      newConversation,
      selectConversation,
      openProject,
      showCapabilities,
      sendMessage,
      editAndResend,
      regenerateLast,
      renameConversation,
      deleteConversation,
      moveConversation,
      createProject,
      updateProject,
      addProjectMemory,
      removeProjectMemory,
      addProjectFiles,
      removeProjectFile,
      deleteProject,
      setTheme,
      setModel,
    }),
    [
      state,
      activeConversation,
      activeProject,
      isLoading,
      storageError,
      newConversation,
      selectConversation,
      openProject,
      showCapabilities,
      sendMessage,
      editAndResend,
      regenerateLast,
      renameConversation,
      deleteConversation,
      moveConversation,
      createProject,
      updateProject,
      addProjectMemory,
      removeProjectMemory,
      addProjectFiles,
      removeProjectFile,
      deleteProject,
      setTheme,
      setModel,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore deve ser usado dentro de <StoreProvider>")
  return ctx
}
