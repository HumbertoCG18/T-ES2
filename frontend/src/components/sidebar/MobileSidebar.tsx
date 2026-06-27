import * as DialogPrimitive from "@radix-ui/react-dialog"

import { Sidebar } from "./Sidebar"

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden" />
        <DialogPrimitive.Content className="sheet-content fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] border-r border-border shadow-xl outline-none md:hidden">
          <DialogPrimitive.Title className="sr-only">
            Menu de navegação
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Conversas, projetos e configurações.
          </DialogPrimitive.Description>
          <Sidebar mobile onClose={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
