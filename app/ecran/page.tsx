"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type Eleve = {
  id: number
  nom: string
  niveau: number
  regle_manquement: number
  regle_retenue: number
  regle_retrait: number
  groupe_id: number
}

export default function Ecran() {
  const [eleves, setEleves] = useState<Eleve[]>([])

  async function charger() {
    const { data: config, error: configError } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single()

    if (configError) {
      console.error("ERREUR CONFIG:", configError)
      setEleves([])
      return
    }

    if (!config || !config.groupe_actif) {
      setEleves([])
      return
    }

    const { data, error } = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id", config.groupe_actif)
      .order("id", { ascending: true })

    if (error) {
      console.error("ERREUR CHARGEMENT ÉLÈVES:", error)
      setEleves([])
      return
    }

    setEleves((data as Eleve[]) || [])
  }

  useEffect(() => {
    charger()
    const interval = setInterval(charger, 500)
    return () => clearInterval(interval)
  }, [])

  // ✅ LOGIQUE CORRIGÉE
  // L’élève reste dans toutes les colonnes déjà atteintes.
  // Le retrait direct fonctionne automatiquement puisque les autres règles = 0.
  const manquement = useMemo(
    () =>
      eleves
        .filter((e) => (e.regle_manquement ?? 0) > 0)
        .slice()
        .reverse(),
    [eleves]
  )

  const retenue = useMemo(
    () =>
      eleves
        .filter((e) => (e.regle_retenue ?? 0) > 0)
        .slice()
        .reverse(),
    [eleves]
  )

  const retrait = useMemo(
    () =>
      eleves
        .filter((e) => (e.regle_retrait ?? 0) > 0)
        .slice()
        .reverse(),
    [eleves]
  )

  function getCardTextClass(count: number) {
    if (count <= 2) return "text-[clamp(2.8rem,5.2vw,5.5rem)]"
    if (count <= 4) return "text-[clamp(2.2rem,4.2vw,4.6rem)]"
    if (count <= 6) return "text-[clamp(1.8rem,3.5vw,3.8rem)]"
    if (count <= 8) return "text-[clamp(1.4rem,2.8vw,3rem)]"
    return "text-[clamp(1.1rem,2.1vw,2.2rem)]"
  }

  function getHeaderTextClass() {
    return "text-[clamp(1.4rem,2.4vw,3rem)]"
  }

  function getItemSpacingClass(count: number) {
    if (count <= 3) return "gap-6"
    if (count <= 6) return "gap-4"
    if (count <= 9) return "gap-3"
    return "gap-2"
  }

  function getTopPaddingClass(count: number) {
    if (count <= 3) return "pt-8"
    if (count <= 6) return "pt-6"
    return "pt-4"
  }

  function renderColonne(
    titre: string,
    headerBg: string,
    bodyBg: string,
    items: Eleve[],
    regleKey: "regle_manquement" | "regle_retenue" | "regle_retrait"
  ) {
    const textClass = getCardTextClass(items.length)
    const spacingClass = getItemSpacingClass(items.length)
    const topPaddingClass = getTopPaddingClass(items.length)

    return (
      <div className={`flex-1 flex flex-col ${bodyBg} border-r-4 border-white last:border-r-0 min-w-0`}>
        <div
          className={`w-full ${headerBg} text-white text-center font-bold py-4 ${getHeaderTextClass()} leading-none`}
        >
          {titre}
        </div>

        <div className={`flex-1 flex flex-col items-center ${topPaddingClass} px-3 pb-4 overflow-hidden`}>
          <div className={`w-full flex flex-col items-center ${spacingClass} overflow-hidden`}>
            {items.map((e) => (
              <div
                key={`${titre}-${e.id}`}
                className={`${textClass} font-bold text-gray-900 leading-[0.95] text-center max-w-full break-words`}
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {e.nom} #{e[regleKey]}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      {/* ✅ Zone uniforme 16:9 sur tous les appareils */}
      <div
        className="bg-gray-100 overflow-hidden"
        style={{
          width: "min(100vw, calc(100vh * 16 / 9))",
          height: "min(100vh, calc(100vw * 9 / 16))",
        }}
      >
        <div className="w-full h-full flex">
          {renderColonne(
            "Manquement",
            "bg-yellow-600",
            "bg-yellow-300",
            manquement,
            "regle_manquement"
          )}

          {renderColonne(
            "Retenue",
            "bg-orange-600",
            "bg-orange-200",
            retenue,
            "regle_retenue"
          )}

          {renderColonne(
            "Retrait",
            "bg-red-600",
            "bg-red-200",
            retrait,
            "regle_retrait"
          )}
        </div>
      </div>
    </div>
  )
}
