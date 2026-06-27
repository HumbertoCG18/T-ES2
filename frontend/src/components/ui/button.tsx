import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "h-9 rounded-full px-4 py-2 text-sm bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm",
        secondary:
          "h-9 rounded-full px-4 py-2 text-sm border border-border bg-card text-foreground hover:bg-foreground/[0.04]",
        ghost:
          "h-9 rounded-full px-3 text-sm text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
        subtle:
          "h-9 rounded-lg px-3 text-sm text-foreground hover:bg-foreground/[0.06]",
        danger:
          "h-9 rounded-full px-4 py-2 text-sm bg-transparent text-red-600 hover:bg-red-500/10 dark:text-red-400",
        icon: "h-9 w-9 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm",
        iconGhost:
          "h-8 w-8 rounded-lg text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, className }))}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
