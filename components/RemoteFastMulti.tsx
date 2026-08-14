"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export default function RemoteFastMulti() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname.startsWith("/telecommande/")) return

    const sync = () => {
      const buttons = Array.from(document.querySelectorAll("button"))
      const ok = buttons.find((button) => /^OK \(\d+\)$/.test((button.textContent || "").trim()))

      if (!ok) return

      ok.style.display = "none"

      if (!ok.disabled) {
        ok.click()
      }
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"],
    })

    return () => observer.disconnect()
  }, [pathname])

  return null
}
