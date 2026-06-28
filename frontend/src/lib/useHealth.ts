import { useEffect, useState } from "react"

import { fetchServices } from "@/lib/api"

/**
 * Saúde da plataforma: pinga /services (via gateway) periodicamente.
 * Retorna null enquanto verifica, true se acessível, false se fora.
 */
export function useHealth(intervalMs = 30000): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    const check = () =>
      fetchServices()
        .then((s) => {
          if (active) setOnline(s.length > 0)
        })
        .catch(() => {
          if (active) setOnline(false)
        })
    check()
    const id = setInterval(check, intervalMs)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [intervalMs])

  return online
}
