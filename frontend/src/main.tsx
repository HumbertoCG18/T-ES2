import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

// Fontes locais (offline-first). Os pesos variáveis cobrem toda a UI.
import "@fontsource-variable/inter/index.css"
import "@fontsource-variable/source-serif-4/index.css"
import "@fontsource-variable/jetbrains-mono/index.css"

// CSS do KaTeX (LaTeX nas respostas). O tema do highlight.js é definido na
// paleta em index.css (.hljs-*), para funcionar nos modos claro e escuro.
import "katex/dist/katex.min.css"

import "./index.css"
import App from "./App.tsx"
import { StoreProvider } from "./store/store.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
