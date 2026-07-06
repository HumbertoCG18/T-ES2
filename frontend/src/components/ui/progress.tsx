import { cn } from "@/lib/utils"

/** Barra de progresso simples (0–100). `tone` muda a cor do indicador. */
export function Progress({
  value,
  tone = "accent",
  className,
}: {
  value: number
  tone?: "accent" | "warning"
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          tone === "warning" ? "bg-warning" : "bg-accent",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
