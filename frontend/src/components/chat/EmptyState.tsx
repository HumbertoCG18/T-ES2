import { Logo } from "@/components/Logo"

export function EmptyState({ title = "Como posso ajudar?" }: { title?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Logo className="mb-4 h-10 w-10 text-accent" />
      <h1 className="font-display text-4xl font-normal tracking-tight text-foreground sm:text-[2.75rem]">
        {title}
      </h1>
    </div>
  )
}
