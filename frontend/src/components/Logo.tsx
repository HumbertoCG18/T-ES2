/**
 * Logomark da plataforma: um núcleo com órbita e um satélite — alusão ao ciclo agêntico
 * (raciocínio → ação → observação) e à orquestração de serviços. Monocromático (currentColor).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="Plataforma de Agentes"
    >
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="4.4"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.45"
        transform="rotate(-28 12 12)"
      />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" />
      <circle cx="19.1" cy="8.2" r="1.7" fill="currentColor" />
    </svg>
  )
}
