import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  deleteOllamaModel,
  listOllamaModels,
  pullOllamaModel,
  type OllamaModel,
  type PullProgress,
} from "@/lib/api"
import { formatBytes } from "@/lib/files"
import { OLLAMA_CATALOG } from "@/store/types"

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** Comando CLI copiável (a stack roda o Ollama em container; via Compose). */
function pullCommand(name: string): string {
  return `docker compose exec ollama ollama pull ${name}`
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—"
  const s = Math.round(seconds)
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}min ${s % 60}s` : `${s}s`
}

interface PullState {
  model: string
  status: string
  completed: number
  total: number
  speed: number // bytes/s
  eta: number // s
}

/** Aba "Modelos" das Configurações: listar instalados, baixar (com progresso) e remover. */
export function ModelsSettings() {
  const [installed, setInstalled] = useState<OllamaModel[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [freeText, setFreeText] = useState("")
  const [pull, setPull] = useState<PullState | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const speedRef = useRef<{ t: number; c: number; speed: number } | null>(null)
  // Último total/completed conhecido (eventos de "verifying"/"writing" não trazem bytes).
  const progressRef = useRef({ total: 0, completed: 0 })

  const refresh = useCallback(() => {
    setInstalled(null)
    setLoadError(false)
    listOllamaModels()
      .then(setInstalled)
      .catch(() => {
        setInstalled([])
        setLoadError(true)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const installedNames = new Set((installed ?? []).map((m) => m.name))

  const startPull = useCallback(
    (name: string) => {
      const model = name.trim()
      if (!model || pull) return
      setPullError(null)
      speedRef.current = null
      progressRef.current = { total: 0, completed: 0 }
      setPull({ model, status: "iniciando…", completed: 0, total: 0, speed: 0, eta: 0 })
      const ctrl = new AbortController()
      abortRef.current = ctrl

      pullOllamaModel(
        model,
        (p: PullProgress) => {
          // Computa fora do updater do setState (mutar refs no updater quebra no StrictMode,
          // que invoca o updater 2×). Aqui roda uma vez por evento.
          const total = p.total ?? progressRef.current.total
          const completed = p.completed ?? progressRef.current.completed
          progressRef.current = { total, completed }

          // Velocidade: Δbytes/Δtempo, suavizada; reseta ao trocar de camada (completed cai).
          let speed = speedRef.current?.speed ?? 0
          const now = Date.now()
          const last = speedRef.current
          if (last && completed >= last.c) {
            const dt = (now - last.t) / 1000
            if (dt >= 0.5) {
              const inst = (completed - last.c) / dt
              speed = last.speed ? last.speed * 0.6 + inst * 0.4 : inst
              speedRef.current = { t: now, c: completed, speed }
            }
          } else {
            speedRef.current = { t: now, c: completed, speed: 0 }
            speed = 0
          }
          const eta = speed > 0 && total > completed ? (total - completed) / speed : 0
          setPull({ model, status: p.status || "baixando…", completed, total, speed, eta })
        },
        ctrl.signal,
      )
        .then(() => {
          setPull(null)
          abortRef.current = null
          refresh()
        })
        .catch((e: unknown) => {
          abortRef.current = null
          if (ctrl.signal.aborted) {
            setPull(null)
            return
          }
          setPull(null)
          setPullError(
            e instanceof Error && e.message && !e.message.startsWith("http_error")
              ? `Falha ao baixar: ${e.message}`
              : "Falha ao baixar. O Ollama está no ar e com acesso à internet?",
          )
        })
    },
    [pull, refresh],
  )

  const cancelPull = useCallback(() => abortRef.current?.abort(), [])

  const copyCmd = useCallback((name: string) => {
    navigator.clipboard?.writeText(pullCommand(name)).then(
      () => {
        setCopied(name)
        window.setTimeout(() => setCopied((c) => (c === name ? null : c)), 1500)
      },
      () => {},
    )
  }, [])

  const doDelete = useCallback(
    (name: string) => {
      deleteOllamaModel(name)
        .then(() => {
          setConfirmDelete(null)
          refresh()
        })
        .catch(() => setConfirmDelete(null))
    },
    [refresh],
  )

  const pct = pull && pull.total > 0 ? (pull.completed / pull.total) * 100 : 0

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Modelos do Ollama instalados localmente. Baixar um modelo novo exige internet (registro do
        Ollama) — é <strong>setup</strong>; o chat continua rodando 100% local.
      </p>

      {/* Download em andamento */}
      {pull && (
        <div className="rounded-xl border border-accent/30 bg-accent/[0.05] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              Baixando <span className="font-mono">{pull.model}</span>
            </span>
            <button onClick={cancelPull} aria-label="Cancelar download" className={iconBtn}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Progress value={pct} className="mt-2" />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
            <span>
              {formatBytes(pull.completed)} / {pull.total ? formatBytes(pull.total) : "?"}
            </span>
            <span>{pull.speed > 0 ? `${formatBytes(pull.speed)}/s` : "—"}</span>
            <span>ETA {formatEta(pull.eta)}</span>
            <span className="truncate text-muted-foreground/70">{pull.status}</span>
          </div>
        </div>
      )}
      {pullError && <p className="text-sm text-destructive">{pullError}</p>}

      {/* Instalados */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Instalados</h3>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Atualizar
          </button>
        </div>
        {installed === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : installed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loadError
              ? "Não consegui falar com o Ollama (via gateway). A plataforma está no ar?"
              : "Nenhum modelo instalado ainda. Baixe um abaixo."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {installed.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm text-foreground">{m.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatBytes(m.size)}
                    {m.parameterSize ? ` · ${m.parameterSize}` : ""}
                    {m.quantization ? ` · ${m.quantization}` : ""}
                  </span>
                </div>
                {confirmDelete === m.name ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="dangerSolid"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => doDelete(m.name)}
                    >
                      Remover
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancelar
                    </Button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(m.name)}
                    aria-label={`Remover ${m.name}`}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Baixar novo */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Baixar novo modelo</h3>
          <a
            href="https://ollama.com/search"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> Catálogo completo
          </a>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OLLAMA_CATALOG.map((m) => {
            const has = installedNames.has(m.name) || installedNames.has(`${m.name}:latest`)
            return (
              <div
                key={m.name}
                className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{m.label}</span>
                  {m.tag && (
                    <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-accent">
                      {m.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{m.description}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[0.7rem] text-muted-foreground">
                    {m.name} · {m.size}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => copyCmd(m.name)}
                      title={pullCommand(m.name)}
                      aria-label={`Copiar comando para ${m.name}`}
                      className={iconBtn}
                    >
                      {copied === m.name ? (
                        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                    {has ? (
                      <span className="inline-flex items-center gap-1 px-1 text-xs text-success">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Instalado
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        className="h-7 px-2.5 text-xs"
                        disabled={!!pull}
                        onClick={() => startPull(m.name)}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" /> Baixar
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Por nome (qualquer tag) */}
        <div className="mt-3">
          <label htmlFor="pull-name" className="text-xs font-medium text-muted-foreground">
            Ou baixe por nome (qualquer tag do ollama.com)
          </label>
          <div className="mt-1 flex gap-2">
            <Input
              id="pull-name"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="ex.: qwen2.5:3b"
              onKeyDown={(e) => {
                if (e.key === "Enter") startPull(freeText)
              }}
            />
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={!freeText.trim() || !!pull}
              onClick={() => startPull(freeText)}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Baixar
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
