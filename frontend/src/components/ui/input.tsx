import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50",
      className,
    )}
    {...props}
  />
))
Input.displayName = "Input"

export { Input }
