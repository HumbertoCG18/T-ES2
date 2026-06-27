import { useStore } from "@/store/store"
import { Composer } from "./Composer"
import { EmptyState } from "./EmptyState"
import { MessageList } from "./MessageList"
import { TopBar } from "./TopBar"

interface ChatViewProps {
  collapsed: boolean
  onExpand: () => void
  onOpenMobile: () => void
}

export function ChatView({ collapsed, onExpand, onOpenMobile }: ChatViewProps) {
  const { activeConversation, isLoading, sendMessage } = useStore()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        collapsed={collapsed}
        onExpand={onExpand}
        onOpenMobile={onOpenMobile}
      />

      {!activeConversation ? (
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-24">
          <div className="w-full max-w-2xl">
            <EmptyState />
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Faça uma pergunta para começar uma nova conversa.
            </p>
            <div className="mt-8">
              <Composer onSend={sendMessage} disabled={isLoading} autoFocus />
            </div>
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col">
          <MessageList
            messages={activeConversation.messages}
            conversationId={activeConversation.id}
          />
          <div className="border-t border-border bg-background">
            <div className="mx-auto w-full max-w-3xl px-4 py-4">
              <Composer onSend={sendMessage} disabled={isLoading} />
              <p className="mt-2 text-center text-xs text-muted-foreground/70">
                A plataforma pode cometer erros. Verifique informações
                importantes.
              </p>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
