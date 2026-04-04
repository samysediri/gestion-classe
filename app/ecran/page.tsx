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
    const { data: config, error: configError } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single()

    if (configError) {
      console.error("ERREUR CONFIG:", configError)
      setEleves([])
      setToilettesActives([])
      setToilettesDernieres([])
      return
    }

    if (!config || !config.groupe_actif) {
      setEleves([])
      setToilettesActives([])
      setToilettesDernieres([])
      setPhaseCours("modelage")
      return
    }

    setPhaseCours(normalizePhase(config.phase_cours))

    const [
      { data: elevesData, error: elevesError },
      { data: toilettesActivesData, error: toilettesActivesError },
      { data: toilettesHistData, error: toilettesHistError },
    ] = await Promise.all([
      supabase
        .from("eleves")
        .select("*")
        .eq("groupe_id", config.groupe_actif)
        .order("id", { ascending: true }),

      supabase
        .from("toilettes")
        .select("*")
        .eq("groupe_id", config.groupe_actif)
        .eq("actif", true)
        .order("slot", { ascending: true }),

      supabase
        .from("toilettes")
        .select("*")
        .eq("groupe_id", config.groupe_actif)
        .eq("actif", false)
        .order("ended_at", { ascending: false })
        .limit(50),
    ])

    if (elevesError) {
      console.error("ERREUR CHARGEMENT ÉLÈVES:", elevesError)
      setEleves([])
    } else {
      setEleves((elevesData as Eleve[]) || [])
    }

    if (toilettesActivesError) {
      console.error("ERREUR TOILETTES ACTIVES:", toilettesActivesError)
      setToilettesActives([])
    } else {
      setToilettesActives((toilettesActivesData as ToiletteRecord[]) || [])
    }

 if (toilettesHistError) {
  console.error("ERREUR TOILETTES HIST:", toilettesHistError)
  setToilettesDernieres([])
} else {
  setToilettesDernieres((toilettesHistData ?? []) as ToiletteRecord[])
}

  useEffect(() => {
    charger()

    const interval = setInterval(() => {
      charger()
    }, 800)

    const tick = setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(tick)
    }
  }, [])

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

  function getTextSize(count: number) {
    if (count <= 2) return "text-[clamp(2.6rem,5.2vw,5.4rem)]"
    if (count <= 4) return "text-[clamp(2rem,4.2vw,4.3rem)]"
    if (count <= 6) return "text-[clamp(1.6rem,3.2vw,3.2rem)]"
    if (count <= 8) return "text-[clamp(1.25rem,2.5vw,2.5rem)]"
    return "text-[clamp(1rem,1.8vw,1.8rem)]"
  }

  function getHeaderTextClass() {
    return "text-[clamp(1.6rem,2.8vw,3.2rem)]"
  }

  function getSpacingClass(count: number) {
    if (count <= 3) return "gap-5"
    if (count <= 6) return "gap-3"
    if (count <= 9) return "gap-2"
    return "gap-1.5"
  }

  function getPhaseLabel(phase: PhaseCours) {
    if (phase === "pratique_guidee") return "Pratique guidée"
    if (phase === "pratique_autonome") return "Pratique autonome"
    return "Modelage"
  }

  function formatSeconds(totalSeconds: number) {
    const safe = Math.max(0, totalSeconds)
    const minutes = Math.floor(safe / 60)
    const secondes = safe % 60
    return `${String(minutes).padStart(2, "0")}:${String(secondes).padStart(2, "0")}`
  }

  function getDisplayDuration(record: ToiletteRecord | null) {
    if (!record) return "00:00"

    if (record.actif) {
      const startedMs = new Date(record.started_at).getTime()
      return formatSeconds(Math.max(0, Math.round((nowMs - startedMs) / 1000)))
    }

    return formatSeconds(record.duree_secondes ?? 0)
  }

  const toilettesParSlot = useMemo(() => {
    return [1, 2].map((slot) => {
      const active = toilettesActives.find((t) => t.slot === slot)
      if (active) return active

      const finished = toilettesDernieres.find((t) => t.slot === slot)
      if (finished) return finished

      return null
    })
  }, [toilettesActives, toilettesDernieres])

  function renderColonne(
    titre: string,
    headerBg: string,
    bodyBg: string,
    items: Eleve[],
    regleKey: "regle_manquement" | "regle_retenue" | "regle_retrait"
  ) {
    const textClass = getTextSize(items.length)
    const spacingClass = getSpacingClass(items.length)

    return (
      <div className={`flex-1 min-w-0 flex flex-col ${bodyBg} border-r-4 border-white last:border-r-0`}>
        <div
          className={`w-full ${headerBg} text-white text-center font-bold py-[clamp(0.8rem,1.3vw,1.5rem)] ${getHeaderTextClass()} leading-none`}
        >
          {titre}
        </div>

        <div className="flex-1 min-h-0 px-3 py-3 overflow-hidden">
          <div className={`h-full w-full flex flex-col items-center justify-start ${spacingClass} overflow-hidden`}>
            {items.map((e) => (
              <div
                key={`${titre}-${e.id}`}
                className={`${textClass} font-bold text-gray-900 leading-[0.92] text-center max-w-full`}
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

  function renderRedXOverlay() {
    return (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 w-[92%] h-[8px] bg-red-600 rounded-full -translate-x-1/2 -translate-y-1/2 rotate-45 shadow" />
        <div className="absolute left-1/2 top-1/2 w-[92%] h-[8px] bg-red-600 rounded-full -translate-x-1/2 -translate-y-1/2 -rotate-45 shadow" />
      </div>
    )
  }

  function renderToiletteSlot(record: ToiletteRecord | null, slot: number) {
    const hasRecord = !!record
    const isActive = !!record?.actif

    return (
      <div
        key={slot}
        className="relative flex items-center gap-4 rounded-2xl border-2 border-gray-300 bg-white px-5 py-3 min-w-[330px] max-w-[420px]"
      >
        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-100 shrink-0">
          <div className="text-[3.6rem] leading-none">🚽</div>
          {hasRecord && renderRedXOverlay()}
        </div>

        <div className="min-w-0 flex-1">
          {record ? (
            <>
              <div className="font-bold text-[clamp(1.4rem,1.9vw,2rem)] truncate text-gray-900">
                {record.eleve_nom}
              </div>
              <div
                className={`${
                  isActive ? "text-red-600" : "text-gray-700"
                } font-bold text-[clamp(1.45rem,2vw,2.1rem)] leading-none mt-1`}
              >
                {getDisplayDuration(record)}
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-[clamp(1.25rem,1.6vw,1.8rem)] text-gray-400">
                Libre
              </div>
              <div className="text-gray-300 font-bold text-[clamp(1.25rem,1.7vw,1.8rem)] leading-none mt-1">
                00:00
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      <div
        className="bg-gray-100 overflow-hidden"
        style={{
          width: "min(100vw, calc(100vh * 16 / 9))",
          height: "min(100vh, calc(100vw * 9 / 16))",
        }}
      >
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 min-h-0 flex">
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

          <div className="h-[19%] w-full bg-white border-t-4 border-gray-200 px-5 py-3 flex items-center justify-between gap-5 overflow-hidden">
            <div className="flex items-center gap-4 min-w-0">
              {renderToiletteSlot(toilettesParSlot[0], 1)}
              {renderToiletteSlot(toilettesParSlot[1], 2)}
            </div>

            <div className="shrink-0 rounded-2xl bg-indigo-50 border-2 border-indigo-200 px-6 py-4 text-center min-w-[280px]">
              <div className="text-[clamp(1rem,1.2vw,1.2rem)] font-semibold text-indigo-500 uppercase tracking-wide">
                Section du cours
              </div>
              <div className="font-bold text-[clamp(1.8rem,2vw,2.3rem)] text-indigo-900 mt-1">
                {getPhaseLabel(phaseCours)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
