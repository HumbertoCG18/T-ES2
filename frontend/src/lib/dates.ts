import type { Conversation, Project } from "@/store/types"

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Tempo relativo curto: "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", "27 de jun.". */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (diff < min) return "agora"
  if (diff < hour) return `há ${Math.floor(diff / min)} min`
  if (diff < day) return `há ${Math.floor(diff / hour)} h`
  const days = Math.floor(diff / day)
  if (days === 1) return "ontem"
  if (days < 7) return `há ${days} dias`
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

export interface ConversationGroup {
  label: string
  items: Conversation[]
}

/**
 * Agrupa conversas por data (Hoje / Ontem / Anteriores), ordenadas da mais
 * recente para a mais antiga. Retorna apenas grupos não-vazios.
 */
export function groupConversationsByDate(
  conversations: Conversation[],
): ConversationGroup[] {
  const today = startOfDay(Date.now())
  const yesterday = today - 86_400_000

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)

  const hoje: Conversation[] = []
  const ontem: Conversation[] = []
  const anteriores: Conversation[] = []

  for (const c of sorted) {
    const day = startOfDay(c.updatedAt)
    if (day >= today) hoje.push(c)
    else if (day >= yesterday) ontem.push(c)
    else anteriores.push(c)
  }

  return [
    { label: "Hoje", items: hoje },
    { label: "Ontem", items: ontem },
    { label: "Anteriores", items: anteriores },
  ].filter((g) => g.items.length > 0)
}

export interface ProjectGroup {
  projectId: string
  label: string
  items: Conversation[]
}

/**
 * Separa conversas em grupos por projeto (cada grupo ordenado por recência, e os grupos
 * ordenados pela atividade mais recente) e uma lista "avulsa" (sem projeto). Espelha a
 * organização da sidebar do claude.ai (projeto → conversas aninhadas).
 */
export function groupConversationsByProject(
  conversations: Conversation[],
  projects: Project[],
): { projectGroups: ProjectGroup[]; loose: Conversation[] } {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const grouped = new Map<string, Conversation[]>()
  const loose: Conversation[] = []

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const c of sorted) {
    if (c.projectId && byId.has(c.projectId)) {
      const arr = grouped.get(c.projectId) ?? []
      arr.push(c)
      grouped.set(c.projectId, arr)
    } else {
      loose.push(c)
    }
  }

  const projectGroups: ProjectGroup[] = [...grouped.entries()].map(
    ([projectId, items]) => ({ projectId, label: byId.get(projectId)!.name, items }),
  )
  projectGroups.sort((a, b) => b.items[0].updatedAt - a.items[0].updatedAt)

  return { projectGroups, loose }
}
