/**
 * Mini event bus para preencher o composer a partir de outros componentes (ex.: chips de
 * sugestão da tela inicial). Substitui o texto atual e foca, sem passar pelo store.
 */
type Listener = (text: string) => void

const listeners = new Set<Listener>()

export const composerBus = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  fill(text: string): void {
    for (const fn of listeners) fn(text)
  },
}
