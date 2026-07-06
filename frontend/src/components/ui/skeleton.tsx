import { cn } from "@/lib/utils"

/** Placeholder de carregamento (pulsa). Decorativo — aria-hidden. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-foreground/[0.06]", className)}
      aria-hidden="true"
    />
  )
}
