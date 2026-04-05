"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type Eleve = {
  id: number
  nom: string
  niveau: number
  groupe_id: number
}

type ToiletteRecord = {
  id: number
  groupe_id: number
  eleve_id: number | null
  eleve_nom: string
  slot: number
  started_at: string
  ended_at: string | null
  duree_secondes: number | null
  actif: boolean
  created_at: string
}

type PhaseCours = "modelage" | "pratique_guidee" | "pratique_autonome"

export default function Ecran() {
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [toilettesActives, setToilettesActives] = useState<ToiletteRecord[]>([])
  const [toilettesDernieres, setToilettesDernieres] = useState<ToiletteRecord[]>([])
  const [phaseCours, setPhaseCours] = useState<PhaseCours>("modelage")
  const [nowMs, setNowMs] = useState(Date.now())

  function normalizePhase(value: string | null | undefined): PhaseCours {
    if (value === "pratique_guidee") return "pratique_guidee"
    if (value === "pratique_autonome") return "pratique_autonome"
    return "modelage"
  }

  async function charger() {
    const { data: config } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single()

    if (!config || !config.groupe_actif) {
      setEleves([])
      return
    }

    setPhaseCours(normalizePhase(config.phase_cours))

    const { data: elevesData } = await supabase
      .from("eleves")
      .select("id, nom, niveau, groupe_id")
      .eq("groupe_id", config.groupe_actif)

    const { data: toilettesActivesData } = await supabase
      .from("toilettes")
      .select("*")
      .eq("groupe_id", config.groupe_actif)
      .eq("actif", true)

    const { data: toilettesHistData } = await supabase
      .from("toilettes")
      .select("*")
      .eq("groupe_id", config.groupe_actif)
      .eq("actif", false)
      .order("ended_at", { ascending: false })
      .limit(50)

    setEleves((elevesData ?? []) as Eleve[])
    setToilettesActives((toilettesActivesData ?? []) as ToiletteRecord[])
    setToilettesDernieres((toilettesHistData ?? []) as ToiletteRecord[])
  }

  useEffect(() => {
    charger()
    const interval = setInterval(charger, 800)
    const tick = setInterval(() => setNowMs(Date.now()), 1000)

    return () => {
      clearInterval(interval)
      clearInterval(tick)
    }
  }, [])

  // 🔥 NOUVELLE LOGIQUE
  const engagement = eleves.filter((e) => e.niveau === 0)
  const manquement = eleves.filter((e) => e.niveau === 1)
  const retenue = eleves.filter((e) => e.niveau === 2)
  const retrait = eleves.filter((e) => e.niveau === 3)

  function renderColonne(titre: string, bg: string, items: Eleve[]) {
    return (
      <div className={`flex-1 flex flex-col ${bg}`}>
        <div className="text-white text-center font-bold py-4 text-2xl">
          {titre}
        </div>

        <div className="flex-1 flex flex-col items-center gap-2 p-2 overflow-hidden">
          {items.map((e) => (
            <div key={e.id} className="text-xl font-bold">
              {e.nom}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function formatSeconds(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  function getDisplayDuration(record: ToiletteRecord | null) {
    if (!record) return "00:00"

    if (record.actif) {
      const started = new Date(record.started_at).getTime()
      return formatSeconds(Math.floor((nowMs - started) / 1000))
    }

    return formatSeconds(record.duree_secondes ?? 0)
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <div className="w-full h-full flex flex-col bg-gray-100">

        {/* COLONNES */}
        <div className="flex flex-1">
          {renderColonne("Engagement", "bg-green-400", engagement)}
          {renderColonne("Manquement", "bg-yellow-300", manquement)}
          {renderColonne("Retenue", "bg-orange-300", retenue)}
          {renderColonne("Retrait", "bg-red-300", retrait)}
        </div>

        {/* BAS */}
        <div className="h-[18%] bg-white flex items-center justify-between px-6">

          {/* TOILETTES */}
          <div className="flex gap-6">
            {[1, 2].map((slot) => {
              const record =
                toilettesActives.find((t) => t.slot === slot) ||
                toilettesDernieres.find((t) => t.slot === slot)

              return (
                <div key={slot} className="flex items-center gap-3">
                  <div className="text-4xl">🚽</div>
                  <div>
                    <div className="font-bold">
                      {record?.eleve_nom || "Libre"}
                    </div>
                    <div className="font-bold text-red-500">
                      {getDisplayDuration(record || null)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* PHASE */}
          <div className="text-center">
            <div className="text-sm text-gray-500">Section</div>
            <div className="text-2xl font-bold">
              {phaseCours}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
