/**
 * Parser dos passos do ciclo agêntico.
 *
 * As linhas do `trace` chegam em formatos como:
 *   "acao: calculator({"a":40,"b":20}) -> 60"
 *   "resposta final na iteracao 1"
 *   "pensamento: preciso somar os valores"
 *   "observacao: resultado obtido com sucesso"
 *
 * Convertemos cada linha num passo estruturado para renderizar a timeline.
 */

export type TraceKind = "action" | "final" | "thought" | "observation" | "raw"

export interface TraceStep {
  kind: TraceKind
  /** Texto cru original (fallback). */
  raw: string
  /** Rótulo legível do passo. */
  label: string
  /** Nome da ferramenta (apenas para `action`). */
  tool?: string
  /** Argumentos da chamada (apenas para `action`). */
  args?: string
  /** Resultado/observação retornado (apenas para `action`). */
  result?: string
}

const ACTION_RE = /^a[cç][aã]o\s*:\s*(.+)$/i
const FINAL_RE = /^resposta\s+final/i
const THOUGHT_RE = /^pensamento\s*:\s*(.+)$/i
const OBSERVATION_RE = /^observa[cç][aã]o\s*:\s*(.+)$/i
// nome(args) -> resultado
const CALL_RE = /^([\w.:-]+)\s*\(([\s\S]*)\)\s*->\s*([\s\S]*)$/

export function parseTraceStep(line: string): TraceStep {
  const raw = line
  const text = line.trim()

  const finalMatch = FINAL_RE.test(text)
  if (finalMatch) {
    return { kind: "final", raw, label: "Resposta final" }
  }

  const actionMatch = text.match(ACTION_RE)
  if (actionMatch) {
    const body = actionMatch[1].trim()
    const call = body.match(CALL_RE)
    if (call) {
      return {
        kind: "action",
        raw,
        label: "Ação",
        tool: call[1].trim(),
        args: call[2].trim(),
        result: call[3].trim(),
      }
    }
    return { kind: "action", raw, label: "Ação", tool: body }
  }

  const thoughtMatch = text.match(THOUGHT_RE)
  if (thoughtMatch) {
    return { kind: "thought", raw, label: thoughtMatch[1].trim() }
  }

  const obsMatch = text.match(OBSERVATION_RE)
  if (obsMatch) {
    return { kind: "observation", raw, label: obsMatch[1].trim() }
  }

  return { kind: "raw", raw, label: text }
}

export function parseTrace(trace: string[]): TraceStep[] {
  return trace.map(parseTraceStep)
}
