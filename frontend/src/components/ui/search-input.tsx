import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Classe do wrapper (posicionamento/largura). */
  wrapperClassName?: string
}

/** Campo de busca padrão: ícone à esquerda + input. Unifica as buscas do app. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, ...props }, ref) => (
    <div className={cn("relative", wrapperClassName)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/30",
          className,
        )}
        {...props}
      />
    </div>
  ),
)
SearchInput.displayName = "SearchInput"
