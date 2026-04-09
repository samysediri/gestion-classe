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
  bravo_progress: number
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
type EcranMode = "colonnes" | "ratio"

type SessionCoursRow = {
  id: number
  groupe_id: number
  date_cours: string
  started_at: string
  ended_at: string | null
  phase_depart: string | null
  phase_fin: string | null
  actif: boolean
}

type LogRow = {
  id: number
  session_id: number
  groupe_id: number
  eleve_id: number
  eleve_nom: string
  action_type:
    | "manquement"
    | "retenue"
    | "retrait"
    | "retrait_direct"
    | "toilettes_depart"
    | "toilettes_retour"
    | "bravo"
    | "manquement_retire"
    | "retenue_retiree"
  regle: number | null
  niveau_avant: number | null
  niveau_apres: number | null
  phase_cours: string | null
  created_at: string
}

type ConfigRow = {
  id: number
  groupe_actif: number | null
  en_cours: boolean
  phase_cours: PhaseCours | null
  bravos_par_palier: number
  bravo_display_seconds: number
  ecran_mode: EcranMode | null
}

export default function Ecran() {
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [toilettesActives, setToilettesActives] = useState<ToiletteRecord[]>([])
  const [toilettesDernieres, setToilettesDernieres] = useState<ToiletteRecord[]>([])
  const [phaseCours, setPhaseCours] = useState<PhaseCours>("modelage")
  const [ecranMode, setEcranMode] = useState<EcranMode>("colonnes")
  const [nowMs, setNowMs] = useState(Date.now())

  const [bravosRecents, setBravosRecents] = useState<LogRow[]>([])
  const [logsSession, setLogsSession] = useState<LogRow[]>([])
  const [dernierResumeSession, setDernierResumeSession] = useState<SessionCoursRow | null>(null)
  const [dernierResumeBravoCount, setDernierResumeBravoCount] = useState(0)
  const [bravoDisplaySeconds, setBravoDisplaySeconds] = useState(30)

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
      setBravosRecents([])
      setLogsSession([])
      setDernierResumeSession(null)
      setDernierResumeBravoCount(0)
      return
    }

    const cfg = config as ConfigRow
    setBravoDisplaySeconds(cfg.bravo_display_seconds ?? 30)
    setEcranMode(cfg.ecran_mode ?? "colonnes")

    if (!cfg || !cfg.groupe_actif) {
      setEleves([])
      setToilettesActives([])
      setToilettesDernieres([])
      setPhaseCours("modelage")
      setBravosRecents([])
      setLogsSession([])

      const { data: lastSession, error: lastSessionError } = await supabase
        .from("sessions_cours")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastSessionError) {
        console.error("ERREUR DERNIERE SESSION:", lastSessionError)
        setDernierResumeSession(null)
        setDernierResumeBravoCount(0)
        return
      }

      if (!lastSession) {
        setDernierResumeSession(null)
        setDernierResumeBravoCount(0)
        return
      }

      setDernierResumeSession(lastSession as SessionCoursRow)

      const { count, error: bravoCountError } = await supabase
        .from("ecarts_conduite_log")
        .select("*", { count: "exact", head: true })
        .eq("session_id", lastSession.id)
        .eq("action_type", "bravo")

      if (bravoCountError) {
        console.error("ERREUR COUNT BRAVOS:", bravoCountError)
        setDernierResumeBravoCount(0)
      } else {
        setDernierResumeBravoCount(count ?? 0)
      }

      return
    }

    setDernierResumeSession(null)
    setDernierResumeBravoCount(0)
    setPhaseCours(normalizePhase(cfg.phase_cours))

    const { data: activeSession, error: activeSessionError } = await supabase
      .from("sessions_cours")
      .select("*")
      .eq("groupe_id", cfg.groupe_actif)
      .eq("actif", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeSessionError) {
      console.error("ERREUR SESSION ACTIVE:", activeSessionError)
    }

    const [
      { data: elevesData, error: elevesError },
      { data: toilettesActivesData, error: toilettesActivesError },
      { data: toilettesHistData, error: toilettesHistError },
      { data: bravoLogsData, error: bravoLogsError },
      { data: logsData, error: logsError },
    ] = await Promise.all([
      supabase
        .from("eleves")
        .select("*")
        .eq("groupe_id", cfg.groupe_actif)
        .order("id", { ascending: true }),

      supabase
        .from("toilettes")
        .select("*")
        .eq("groupe_id", cfg.groupe_actif)
        .eq("actif", true)
        .order("slot", { ascending: true }),

      supabase
        .from("toilettes")
        .select("*")
        .eq("groupe_id", cfg.groupe_actif)
        .eq("actif", false)
        .order("ended_at", { ascending: false })
        .limit(50),

      activeSession?.id
        ? supabase
            .from("ecarts_conduite_log")
            .select("*")
            .eq("session_id", activeSession.id)
            .eq("action_type", "bravo")
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [], error: null }),

      activeSession?.id
        ? supabase
            .from("ecarts_conduite_log")
            .select("*")
            .eq("session_id", activeSession.id)
            .order("created_at", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (elevesError) {
      console.error("ERREUR CHARGEMENT ÉLÈVES:", elevesError)
      setEleves([])
    } else {
      setEleves(
        ((elevesData ?? []) as Eleve[]).map((e) => ({
          ...e,
          bravo_progress: e.bravo_progress ?? 0,
        }))
      )
    }

    if (toilettesActivesError) {
      console.error("ERREUR TOILETTES ACTIVES:", toilettesActivesError)
      setToilettesActives([])
    } else {
      setToilettesActives((toilettesActivesData ?? []) as ToiletteRecord[])
    }

    if (toilettesHistError) {
      console.error("ERREUR TOILETTES HIST:", toilettesHistError)
      setToilettesDernieres([])
    } else {
      setToilettesDernieres((toilettesHistData ?? []) as ToiletteRecord[])
    }

    if (bravoLogsError) {
      console.error("ERREUR BRAVOS:", bravoLogsError)
      setBravosRecents([])
    } else {
      setBravosRecents((bravoLogsData ?? []) as LogRow[])
    }

    if (logsError) {
      console.error("ERREUR LOGS SESSION:", logsError)
      setLogsSession([])
    } else {
      setLogsSession((logsData ?? []) as LogRow[])
    }
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

  const bravo = useMemo(() => {
    const windowMs = bravoDisplaySeconds * 1000

    return bravosRecents
      .filter((log) => nowMs - new Date(log.created_at).getTime() <= windowMs)
      .slice()
      .reverse()
  }, [bravosRecents, nowMs, bravoDisplaySeconds])

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

  const positifs = useMemo(
  () => logsSession.filter((l) => l.action_type === "bravo").length,
  [logsSession]
)

const negatifs = useMemo(
  () =>
    logsSession.filter((l) =>
      ["retenue", "retrait", "retrait_direct"].includes(l.action_type)
    ).length,
  [logsSession]
)

  const totalRatio = positifs + negatifs
  const ratioPositif = totalRatio === 0 ? 0 : Math.round((positifs / totalRatio) * 100)

  function getTextSize(count: number) {
    if (count <= 2) return "text-[clamp(2.3rem,4.6vw,4.8rem)]"
    if (count <= 4) return "text-[clamp(1.8rem,3.7vw,3.9rem)]"
    if (count <= 6) return "text-[clamp(1.4rem,2.8vw,2.9rem)]"
    if (count <= 8) return "text-[clamp(1.15rem,2.1vw,2.1rem)]"
    return "text-[clamp(0.95rem,1.6vw,1.6rem)]"
  }

  function getHeaderTextClass() {
    return "text-[clamp(1.3rem,2.2vw,2.7rem)]"
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

  function getSuffixeBravo(
    e: Eleve,
    regleKey: "regle_manquement" | "regle_retenue" | "regle_retrait"
  ) {
    const progress = e.bravo_progress ?? 0
    if (progress <= 0) return ""

    if (regleKey === "regle_retrait") return ""

    if (regleKey === "regle_retenue" && (e.regle_retenue ?? 0) > 0) {
  return " 👍"
}

if (
  regleKey === "regle_manquement" &&
  (e.regle_manquement ?? 0) > 0 &&
  (e.regle_retenue ?? 0) === 0
) {
  return " 👍"
}

return ""
}


  function renderColonneBravo(items: LogRow[]) {
    const textClass = getTextSize(items.length)
    const spacingClass = getSpacingClass(items.length)

    return (
      <div className="flex-1 min-w-0 flex flex-col bg-green-200 border-r-4 border-white">
        <div
          className={`w-full bg-green-600 text-white text-center font-bold py-[clamp(0.8rem,1.3vw,1.5rem)] ${getHeaderTextClass()} leading-none`}
        >
          Bravo!
        </div>

        <div className="flex-1 min-h-0 px-3 py-3 overflow-hidden">
          <div className={`h-full w-full flex flex-col items-center justify-start ${spacingClass} overflow-hidden`}>
            {items.map((log) => (
              <div
                key={`bravo-${log.id}`}
                className={`${textClass} font-bold text-gray-900 leading-[0.92] text-center max-w-full`}
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {log.eleve_nom}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

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
                {e.nom}
{getSuffixeBravo(e, regleKey)}
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

  if (dernierResumeSession) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
        <div
          className="bg-gradient-to-br from-green-100 to-emerald-200 overflow-hidden flex items-center justify-center"
          style={{
            width: "min(100vw, calc(100vh * 16 / 9))",
            height: "min(100vh, calc(100vw * 9 / 16))",
          }}
        >
          <div className="text-center px-10">
            <div className="text-[clamp(2rem,4vw,4rem)] font-extrabold text-emerald-800">
              🎉 Fin du cours 🎉
            </div>

            <div className="mt-6 text-[clamp(1.6rem,3vw,3rem)] font-bold text-gray-900">
              Bravo donnés : {dernierResumeBravoCount}
            </div>

            <div className="mt-4 text-[clamp(1.1rem,1.8vw,1.6rem)] text-gray-700">
              Groupe {dernierResumeSession.groupe_id}
            </div>

            <div className="mt-2 text-[clamp(1rem,1.5vw,1.3rem)] text-gray-600">
              Séance terminée
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (ecranMode === "ratio") {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
        <div
          className="bg-black text-white flex items-center justify-center"
          style={{
            width: "min(100vw, calc(100vh * 16 / 9))",
            height: "min(100vh, calc(100vw * 9 / 16))",
          }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center px-10">
            <div className="text-[clamp(2rem,3vw,3rem)] font-semibold text-gray-300 mb-6">
              Ratio positif / négatif
            </div>

            <div className="text-[clamp(4.5rem,10vw,9rem)] font-extrabold leading-none">
              {ratioPositif}%
            </div>

            <div className="mt-5 text-[clamp(1.4rem,2vw,2rem)] font-semibold text-gray-300">
              👍 {positifs} / ❌ {negatifs}
            </div>

            <div className="mt-10 w-[min(70vw,520px)] h-[min(70vw,520px)] rounded-full overflow-hidden shadow-2xl">
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(
                    #22c55e 0% ${ratioPositif}%,
                    #ef4444 ${ratioPositif}% 100%
                  )`,
                }}
              />
            </div>

            {ratioPositif >= 75 && (
              <div className="mt-8 text-[clamp(2rem,3vw,3rem)] font-extrabold text-green-400 text-center">
                🎉 Récompense de groupe ! 🎉
              </div>
            )}

            <div className="mt-6 text-[clamp(1rem,1.4vw,1.2rem)] text-gray-400 text-center">
              Retourne sur la télécommande et appuie sur « RETOUR ÉCRAN » pour revenir aux colonnes.
            </div>
          </div>
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
            {renderColonneBravo(bravo)}

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
