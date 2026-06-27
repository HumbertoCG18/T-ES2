import type { Conversation } from "@/store/types"

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
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
