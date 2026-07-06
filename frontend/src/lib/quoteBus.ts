/**
 * Mini event bus para "citar trecho": a barra de seleção emite o texto selecionado e o
 * Composer (inscrito) o insere como citação. Desacopla os dois sem passar pelo store.
 */
type Listener = (text: string) => void

const listeners = new Set<Listener>()

export const quoteBus = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  emit(text: string): void {
    for (const fn of listeners) fn(text)
  },
}
