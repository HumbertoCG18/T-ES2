import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { MobileSidebar } from "@/components/sidebar/MobileSidebar"
import { ChatView } from "@/components/chat/ChatView"
import { ProjectView } from "@/components/project/ProjectView"
import { CapabilitiesView } from "@/components/capabilities/CapabilitiesView"
import { RecentsView } from "@/components/recents/RecentsView"
import { ProjectsGalleryView } from "@/components/projects/ProjectsGalleryView"
import { useStore } from "@/store/store"

function App() {
  const { state, activeProject } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Fecha o overlay móvel sempre que a navegação muda.
  useEffect(() => {
    setMobileOpen(false)
  }, [state.view])

  const isProject = state.view.type === "project" && activeProject
  const isCapabilities = state.view.type === "capabilities"
  const isRecents = state.view.type === "recents"
  const isProjectsList = state.view.type === "projectsList"

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={0}>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        {/* Sidebar (desktop) — colapsável para 0. */}
        <div
          className={cn(
            "hidden shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out md:block",
            collapsed ? "w-0 border-r-0" : "w-[280px]",
          )}
        >
          <div className="h-full w-[280px]">
            <Sidebar onClose={() => setCollapsed(true)} />
          </div>
        </div>

        {/* Área principal */}
        <div className="flex min-w-0 flex-1 flex-col">
          {isProject ? (
            <ProjectView
              project={activeProject}
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              onOpenMobile={() => setMobileOpen(true)}
            />
          ) : isCapabilities ? (
            <CapabilitiesView
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              onOpenMobile={() => setMobileOpen(true)}
            />
          ) : isRecents ? (
            <RecentsView
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              onOpenMobile={() => setMobileOpen(true)}
            />
          ) : isProjectsList ? (
            <ProjectsGalleryView
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              onOpenMobile={() => setMobileOpen(true)}
            />
          ) : (
            <ChatView
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
              onOpenMobile={() => setMobileOpen(true)}
            />
          )}
        </div>

        {/* Sidebar (mobile) — overlay */}
        <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
      </div>
    </TooltipProvider>
  )
}

export default App
