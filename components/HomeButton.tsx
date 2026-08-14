"use client"

import { usePathname, useRouter } from "next/navigation"

export default function HomeButton() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === "/" || pathname === "/mes-groupes") return null

  return (
    <button
      type="button"
      onClick={() => router.push("/mes-groupes")}
      className="fixed left-3 top-3 z-[9999] rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-sm font-bold text-slate-800 shadow-md backdrop-blur hover:bg-slate-50"
      aria-label="Retour à l'accueil"
    >
      🏠 Accueil
    </button>
  )
}
