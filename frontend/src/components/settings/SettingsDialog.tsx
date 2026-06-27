import { useState, type ReactNode } from "react"
import { Monitor, Moon, Sun } from "lucide-react"

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
import { useStore } from "@/store/store"
import { MODELS, type ThemePref } from "@/store/types"

const APP_VERSION = "1.0.0"

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

export function SettingsDialog({ children }: { children: ReactNode }) {
  const { state, setTheme, setModel } = useStore()
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
          <TabsList className="w-full">
            <TabsTrigger value="geral" className="flex-1">
              Geral
            </TabsTrigger>
            <TabsTrigger value="modelo" className="flex-1">
              Modelo
            </TabsTrigger>
            <TabsTrigger value="sobre" className="flex-1">
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
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
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
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
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
