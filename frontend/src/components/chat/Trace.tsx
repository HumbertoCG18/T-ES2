import { useState } from "react"
import { Brain, CheckCircle, ChevronRight, Sparkles, Wrench } from "lucide-react"

import { cn } from "@/lib/utils"
import { parseTrace, type TraceStep } from "@/lib/trace"

function StepIcon({ kind }: { kind: TraceStep["kind"] }) {
  if (kind === "action") {
    return (
      <span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
        <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    )
  }
  if (kind === "final") {
    return (
      <span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
    </span>
  )
}

function StepBody({ step }: { step: TraceStep }) {
  if (step.kind === "action") {
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Ação
          </span>
          {step.tool && (
            <code className="rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[0.8rem] font-semibold text-accent">
              {step.tool}
            </code>
          )}
        </div>
        {step.args ? (
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border bg-foreground/[0.03] px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            {step.args}
          </pre>
        ) : null}
        {step.result ? (
          <div className="mt-1.5 flex items-baseline gap-1.5 text-sm">
            <span className="font-mono text-muted-foreground">→</span>
            <span className="font-medium text-foreground">{step.result}</span>
          </div>
        ) : null}
      </div>
    )
  }

  if (step.kind === "final") {
    const detail = step.raw.trim().replace(/^resposta\s+final\s*/i, "")
    return (
      <div className="min-w-0">
        <span className="text-sm font-semibold text-foreground">
          Resposta final
        </span>
        {detail && (
          <span className="ml-1.5 text-sm text-muted-foreground">{detail}</span>
        )}
      </div>
    )
  }

  const label =
    step.kind === "thought"
      ? "Raciocínio"
      : step.kind === "observation"
        ? "Observação"
        : null

  return (
    <div className="min-w-0">
      {label && (
        <span className="mr-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      <span className="text-sm text-foreground/90">{step.label}</span>
    </div>
  )
}

export function Trace({ trace }: { trace: string[] }) {
  const [open, setOpen] = useState(false)
  const steps = parseTrace(trace)
  if (steps.length === 0) return null

  // Sem ferramenta (so raciocinio/resposta direta) => "Pensamento"; com acao => "Como cheguei la".
  const hasAction = steps.some((step) => step.kind === "action")

  return (
    <div className="mt-3 max-w-prose">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        {hasAction ? (
          <>
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Como cheguei lá
            <span className="text-muted-foreground/70">
              · {steps.length} {steps.length === 1 ? "passo" : "passos"}
            </span>
          </>
        ) : (
          <>
            <Brain className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Pensamento
          </>
        )}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-foreground/[0.02] p-4">
          <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/80">
            {hasAction ? "Raciocínio → ação → observação" : "Contexto e raciocínio"}
          </p>
          <ol className="relative">
            {steps.map((step, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 && (
                  <span
                    className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
                    aria-hidden="true"
                  />
                )}
                <StepIcon kind={step.kind} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <StepBody step={step} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
