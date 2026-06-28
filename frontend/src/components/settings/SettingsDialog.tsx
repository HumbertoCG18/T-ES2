import { useState, type ReactNode } from "react"
import {
  Boxes,
  ExternalLink,
  Monitor,
  Moon,
  Repeat,
  Server,
  Sun,
  Telescope,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/store/store"
import {
  FONT_OPTIONS,
  MODELS,
  RESPONSE_STYLES,
  type ThemePref,
} from "@/store/types"

const APP_VERSION = "1.0.0"

/** Entregas de infraestrutura (4–7) — visíveis aqui, com link para a UI quando houver. */
const INFRA: {
  entrega: number
  icon: LucideIcon
  title: string
  desc: string
  url?: string
  linkLabel?: string
}[] = [
  {
    entrega: 4,
    icon: Repeat,
    title: "Mensageria assíncrona",
    desc: "RabbitMQ desacopla ingestão de documentos e telemetria do caminho do /chat.",
    url: "http://localhost:15672",
    linkLabel: "Painel do RabbitMQ",
  },
  {
    entrega: 5,
    icon: Boxes,
    title: "Containerização",
    desc: "Dockerfile por serviço + docker-compose.yaml: toda a plataforma sobe com “docker compose up”.",
  },
  {
    entrega: 6,
    icon: Telescope,
    title: "Observabilidade",
    desc: "Rastreamento distribuído (OpenTelemetry → Jaeger): um pedido visto atravessando os serviços.",
    url: "http://localhost:16686",
    linkLabel: "Abrir o Jaeger",
  },
  {
    entrega: 7,
    icon: Server,
    title: "Produção em nuvem (Kubernetes)",
    desc: "Manifests K8s (pasta k8s/) + análise de evolução para nuvem. Cluster rodando é opcional.",
  },
]

const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
]

function Row({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-1 rounded-xl bg-foreground/[0.05] p-1"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsDialog({ children }: { children: ReactNode }) {
  const { state, setTheme, setModel, updateSettings } = useStore()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Personalize a aparência e o comportamento da plataforma.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="geral">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="geral" className="flex-1 shrink-0 min-w-fit">
              Geral
            </TabsTrigger>
            <TabsTrigger value="perfil" className="flex-1 shrink-0 min-w-fit">
              Personalização
            </TabsTrigger>
            <TabsTrigger value="modelo" className="flex-1 shrink-0 min-w-fit">
              Modelo
            </TabsTrigger>
            <TabsTrigger value="infra" className="flex-1 shrink-0 min-w-fit">
              Infraestrutura
            </TabsTrigger>
            <TabsTrigger value="sobre" className="flex-1 shrink-0 min-w-fit">
              Sobre
            </TabsTrigger>
          </TabsList>

          {/* ---------- Geral ---------- */}
          <TabsContent value="geral">
            <div className="divide-y divide-border">
              <Row title="Tema" description="Aparência da interface.">
                <div
                  role="radiogroup"
                  aria-label="Tema"
                  className="flex items-center gap-1 rounded-xl bg-foreground/[0.05] p-1"
                >
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const selected = state.settings.theme === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTheme(opt.value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          selected
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </Row>

              <Row title="Idioma" description="Idioma da interface.">
                <span className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                  Português
                </span>
              </Row>
            </div>
          </TabsContent>

          {/* ---------- Personalização ---------- */}
          <TabsContent value="perfil">
            <div className="divide-y divide-border">
              <Row title="Fonte" description="Tipo de letra da interface.">
                <Segmented
                  ariaLabel="Fonte"
                  options={FONT_OPTIONS}
                  value={state.settings.font ?? "sans"}
                  onChange={(font) => updateSettings({ font })}
                />
              </Row>

              <Row
                title="Tipo de resposta"
                description="Estilo preferido das respostas do agente."
              >
                <Segmented
                  ariaLabel="Tipo de resposta"
                  options={RESPONSE_STYLES}
                  value={state.settings.responseStyle ?? "normal"}
                  onChange={(responseStyle) => updateSettings({ responseStyle })}
                />
              </Row>

              <div className="py-3">
                <label
                  htmlFor="set-nickname"
                  className="text-sm font-medium text-foreground"
                >
                  Como a IA pode te chamar
                </label>
                <Input
                  id="set-nickname"
                  className="mt-1.5"
                  value={state.settings.nickname ?? ""}
                  onChange={(e) => updateSettings({ nickname: e.target.value })}
                  placeholder="Ex.: Humberto"
                  maxLength={60}
                />
              </div>

              <div className="py-3">
                <label
                  htmlFor="set-instructions"
                  className="text-sm font-medium text-foreground"
                >
                  Instruções gerais para a IA
                </label>
                <Textarea
                  id="set-instructions"
                  className="mt-1.5 min-h-[88px]"
                  value={state.settings.instructions ?? ""}
                  onChange={(e) => updateSettings({ instructions: e.target.value })}
                  placeholder="Ex.: responda em português, seja direto e cite as fontes."
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Salvo localmente. Observação: a API atual ainda não envia estas
                  preferências ao agente (serão ligadas ao system prompt depois).
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ---------- Modelo ---------- */}
          <TabsContent value="modelo">
            <p className="mb-3 text-sm text-muted-foreground">
              Modelo padrão para novas conversas.
            </p>
            <div
              role="radiogroup"
              aria-label="Modelo padrão"
              className="flex flex-col gap-2"
            >
              {MODELS.map((m) => {
                const selected = state.settings.model === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setModel(m.id)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selected
                        ? "border-accent/50 bg-accent/[0.06]"
                        : "border-border hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span className="font-mono text-sm font-medium text-foreground">
                      {m.label}
                    </span>
                    <span
                      className={cn(
                        "h-4 w-4 rounded-full border-2",
                        selected
                          ? "border-accent bg-accent"
                          : "border-muted-foreground/40",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Salvo localmente. Observação: a API atual ainda não recebe o
              modelo selecionado.
            </p>
          </TabsContent>

          {/* ---------- Infraestrutura ---------- */}
          <TabsContent value="infra">
            <p className="mb-3 text-sm text-muted-foreground">
              Capacidades de infraestrutura da plataforma (Entregas 4–7). Os links abrem a
              interface do serviço (precisa estar no ar, ex.: via <code>docker compose up</code>).
            </p>
            <div className="flex flex-col gap-2">
              {INFRA.map(({ entrega, icon: Icon, title, desc, url, linkLabel }) => (
                <div
                  key={entrega}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-foreground/[0.04] text-foreground/80">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{title}</span>
                      <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-accent">
                        Entrega {entrega}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        {linkLabel}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ---------- Sobre ---------- */}
          <TabsContent value="sobre">
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p className="text-foreground">
                Plataforma de Agentes Conversacionais
              </p>
              <p>
                Trabalho de Engenharia de Software II — uma interface para
                conversar com agentes que raciocinam, usam ferramentas e
                observam resultados.
              </p>
              <p className="text-xs">Versão {APP_VERSION}</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
