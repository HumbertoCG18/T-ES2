import { useEffect, useState } from "react"
import {
  Database,
  FileSearch,
  Network,
  RefreshCw,
  Repeat,
  Server,
  ShieldCheck,
  Wrench,
} from "lucide-react"

import { ViewHeader } from "@/components/layout/ViewHeader"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  fetchServices,
  fetchTools,
  type ServiceStatus,
  type ToolInfo,
} from "@/lib/api"

interface CapabilitiesViewProps {
  collapsed: boolean
  onExpand: () => void
  onOpenMobile: () => void
}

/** Capacidades da plataforma (descritivas; refletem features reais do backend). */
const PLATFORM = [
  {
    icon: Database,
    title: "Memória de conversação",
    desc: "Curto prazo (Redis) + longo prazo (PostgreSQL) por conversa. O agente lembra dos turnos anteriores.",
  },
  {
    icon: FileSearch,
    title: "Busca semântica (RAG)",
    desc: "Ingestão de documentos + busca vetorial (ChromaDB). Trechos relevantes são injetados no contexto.",
  },
  {
    icon: Repeat,
    title: "Mensageria assíncrona",
    desc: "RabbitMQ: ingestão de documentos e telemetria sem bloquear a resposta ao usuário.",
  },
  {
    icon: Network,
    title: "Service discovery",
    desc: "Eureka: serviços resolvidos por nome lógico (lb://), sem host/porta fixos.",
  },
  {
    icon: ShieldCheck,
    title: "Resiliência (circuit breaker)",
    desc: "Resilience4j: fallback quando um serviço está fora; o chat continua respondendo.",
  },
]

function ToolCard({ tool }: { tool: ToolInfo }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <code className="font-mono text-sm font-semibold text-foreground">
          {tool.name}
        </code>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tool.description}</p>
      {tool.params.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tool.params.map((p) => (
            <span
              key={p.name}
              title={p.description}
              className="inline-flex items-center gap-1 rounded-md bg-foreground/[0.05] px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground"
            >
              {p.name}
              {p.type ? <span className="text-muted-foreground/60">:{p.type}</span> : null}
              {p.required ? <span className="text-accent">*</span> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function CapabilitiesView({
  collapsed,
  onExpand,
  onOpenMobile,
}: CapabilitiesViewProps) {
  const [tools, setTools] = useState<ToolInfo[] | null>(null)
  const [services, setServices] = useState<ServiceStatus[] | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError(false)
    fetchTools()
      .then((t) => setTools(t))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    fetchServices()
      .then((s) => setServices(s))
      .catch(() => setServices([]))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader
        title="Capacidades"
        collapsed={collapsed}
        onExpand={onExpand}
        onOpenMobile={onOpenMobile}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Capacidades
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O que esta plataforma de agentes consegue fazer. As ferramentas são
            consultadas ao vivo no <code className="font-mono">tool-registry</code>.
          </p>

          {/* Ferramentas (ao vivo) */}
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ferramentas do agente
              </h2>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                <RefreshCw
                  className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
                  aria-hidden="true"
                />
                Atualizar
              </button>
            </div>

            <div className="mt-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando ferramentas…</p>
              ) : error ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Não foi possível carregar as ferramentas. Verifique se a plataforma
                  está no ar (api-gateway na 8080 e tool-registry registrado no Eureka).
                </div>
              ) : tools && tools.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {tools.map((t) => (
                    <ToolCard key={t.name} tool={t} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma ferramenta registrada.
                </p>
              )}
            </div>
          </section>

          {/* Saúde dos serviços (ao vivo, via Eureka) */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Serviços (Eureka)
            </h2>
            <div className="mt-3">
              {services === null ? (
                <p className="text-sm text-muted-foreground">Carregando serviços…</p>
              ) : services.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Nenhum serviço descoberto. Verifique o name-server (8761) e o api-gateway.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <Server className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                        {s.name.toLowerCase()}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                        UP
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {s.instances}×
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Capacidades da plataforma */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Capacidades da plataforma
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PLATFORM.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-foreground/[0.04] text-foreground/80">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
