"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../../../lib/supabase"
import { useParams } from "next/navigation"

type Eleve = {
  id: number
  nom: string
  niveau: number
  regle_manquement: number
  regle_retenue: number
  regle_retrait: number
  groupe_id: number
  position_x: number | null
  position_y: number | null
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

type UndoRow = {
  id: number
  niveau: number
  regle_manquement: number
  regle_retenue: number
  regle_retrait: number
  bravo_progress: number
}

type UndoSnapshot = {
  rows: UndoRow[]
}

type PhaseCours = "modelage" | "pratique_guidee" | "pratique_autonome"
type EcranMode = "colonnes" | "ratio"

type ConfigRow = {
  id: number
  groupe_actif: number | null
  en_cours: boolean
  phase_cours: PhaseCours | null
  bravos_par_palier: number
  bravo_display_seconds: number
  ecran_mode: EcranMode | null
}

type ActionType =
  | "manquement"
  | "retenue"
  | "retrait"
  | "retrait_direct"
  | "toilettes_depart"
  | "toilettes_retour"
  | "bravo"
  | "manquement_retire"
  | "retenue_retiree"

const GRID_COLS = 7
const GRID_ROWS = 5
const TEACHER_ZONE_RATIO = 0.12

export default function Page() {
  const params = useParams()
  const groupeId = Number(params.id)

  const [eleves, setEleves] = useState<Eleve[]>([])
  const [selection, setSelection] = useState<number | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const [multiMode, setMultiMode] = useState(false)
  const [multiSelection, setMultiSelection] = useState<number[]>([])
  const [multiReadyForRule, setMultiReadyForRule] = useState(false)

  const [retraitDirect, setRetraitDirect] = useState(false)
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])

  const [toilettesActives, setToilettesActives] = useState<ToiletteRecord[]>([])
  const [phaseCours, setPhaseCours] = useState<PhaseCours>("modelage")
  const [sessionId, setSessionId] = useState<number | null>(null)

  const [bravosParPalier, setBravosParPalier] = useState(2)
  const [bravoDisplaySeconds, setBravoDisplaySeconds] = useState(30)
  const [ecranMode, setEcranMode] = useState<EcranMode>("colonnes")

  const [boardSize, setBoardSize] = useState({ width: 320, height: 240 })

  const boardRef = useRef<HTMLDivElement | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedEleve = useMemo(
    () => eleves.find((e) => e.id === selection) || null,
    [eleves, selection]
  )

  const toiletteActiveSelection = useMemo(() => {
    if (!selectedEleve) return null
    return (
      toilettesActives.find(
        (t) => t.actif && t.eleve_id === selectedEleve.id
      ) || null
    )
  }, [selectedEleve, toilettesActives])

  const studentAreaPercent = 100 - TEACHER_ZONE_RATIO * 100

  useEffect(() => {
    function updateBoardSize() {
      if (!boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      setBoardSize({
        width: rect.width,
        height: rect.height,
      })
    }

    updateBoardSize()

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateBoardSize())
        : null

    if (boardRef.current && observer) {
      observer.observe(boardRef.current)
    }

    window.addEventListener("resize", updateBoardSize)

    return () => {
      window.removeEventListener("resize", updateBoardSize)
      observer?.disconnect()
    }
  }, [])

  function normalizePhase(value: string | null | undefined): PhaseCours {
    if (value === "pratique_guidee") return "pratique_guidee"
    if (value === "pratique_autonome") return "pratique_autonome"
    return "modelage"
  }

  async function chargerConfig() {
    const { data, error } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single()

    if (error) {
      console.error("ERREUR CONFIG:", error)
      return null
    }

    const config = data as ConfigRow
    setPhaseCours(normalizePhase(config.phase_cours))
    setBravosParPalier(config.bravos_par_palier ?? 2)
    setBravoDisplaySeconds(config.bravo_display_seconds ?? 30)
    setEcranMode(config.ecran_mode ?? "colonnes")

    return config
  }

  async function chargerPhaseCours() {
    const config = await chargerConfig()
    if (!config) return
    setPhaseCours(normalizePhase(config.phase_cours))
  }

  async function choisirPhase(phase: PhaseCours) {
    setPhaseCours(phase)

    const { error } = await supabase
      .from("config")
      .update({ phase_cours: phase })
      .eq("id", 1)

    if (error) {
      console.error("ERREUR UPDATE PHASE:", error)
    }
  }

  async function sauvegarderParametresBravo(params: {
    bravos_par_palier?: number
    bravo_display_seconds?: number
  }) {
    const payload: Record<string, number> = {}

    if (typeof params.bravos_par_palier === "number") {
      payload.bravos_par_palier = Math.max(1, Math.min(20, params.bravos_par_palier))
    }

    if (typeof params.bravo_display_seconds === "number") {
      payload.bravo_display_seconds = Math.max(3, Math.min(300, params.bravo_display_seconds))
    }

    const { error } = await supabase
      .from("config")
      .update(payload)
      .eq("id", 1)

    if (error) {
      console.error("ERREUR SAVE PARAMS BRAVO:", error)
    }
  }

  async function changerEcranMode(mode: EcranMode) {
    setEcranMode(mode)

    const { error } = await supabase
      .from("config")
      .update({ ecran_mode: mode })
      .eq("id", 1)

    if (error) {
      console.error("ERREUR ECRAN MODE:", error)
    }
  }

  async function viderToilettesDuGroupe(groupIdToClose: number) {
    const { error } = await supabase
      .from("toilettes")
      .delete()
      .eq("groupe_id", groupIdToClose)

    if (error) {
      console.error("ERREUR DELETE TOILETTES:", error)
    }
  }

  async function ouvrirOuRecupererSession() {
    const { data: existing, error: existingError } = await supabase
      .from("sessions_cours")
      .select("id")
      .eq("groupe_id", groupeId)
      .eq("actif", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error("ERREUR SESSION EXISTANTE:", existingError)
      return null
    }

    if (existing?.id) {
      setSessionId(existing.id)
      return existing.id as number
    }

    const { data: created, error: createError } = await supabase
      .from("sessions_cours")
      .insert([
        {
          groupe_id: groupeId,
          phase_depart: phaseCours,
          actif: true,
        },
      ])
      .select("id")
      .single()

    if (createError) {
      console.error("ERREUR OUVERTURE SESSION:", createError)
      return null
    }

    if (!created?.id) return null

    setSessionId(created.id)
    return created.id as number
  }

  async function loggerAction(params: {
    sessionIdOverride?: number | null
    eleve_id: number
    eleve_nom: string
    action_type: ActionType
    regle?: number | null
    niveau_avant?: number | null
    niveau_apres?: number | null
  }) {
    const activeSessionId = params.sessionIdOverride ?? sessionId

    if (!activeSessionId) {
      console.warn("LOGGER ACTION: aucune session active")
      return
    }

    const { error } = await supabase.from("ecarts_conduite_log").insert([
      {
        session_id: activeSessionId,
        groupe_id: groupeId,
        eleve_id: params.eleve_id,
        eleve_nom: params.eleve_nom,
        action_type: params.action_type,
        regle: params.regle ?? null,
        niveau_avant: params.niveau_avant ?? null,
        niveau_apres: params.niveau_apres ?? null,
        phase_cours: phaseCours,
      },
    ])

    if (error) {
      console.error("ERREUR LOG ACTION:", error)
    }
  }

  async function fermerSession() {
    if (!sessionId) return

    const { error } = await supabase
      .from("sessions_cours")
      .update({
        ended_at: new Date().toISOString(),
        phase_fin: phaseCours,
        actif: false,
      })
      .eq("id", sessionId)

    if (error) {
      console.error("ERREUR FERMETURE SESSION:", error)
    }

    setSessionId(null)
  }

  async function entrerGroupe() {
    const config = await chargerConfig()
    if (!config) return false

    if (config.en_cours && config.groupe_actif !== groupeId) {
      const confirmation = confirm(
        "Un autre groupe est en cours. Voulez-vous le fermer pour utiliser celui-ci ?"
      )

      if (!confirmation) return false

      await supabase
        .from("eleves")
        .update({
          niveau: 0,
          regle_manquement: 0,
          regle_retenue: 0,
          regle_retrait: 0,
          bravo_progress: 0,
        })
        .eq("groupe_id", config.groupe_actif)

      if (config.groupe_actif !== null) {
        await viderToilettesDuGroupe(config.groupe_actif)
      }

      await supabase
        .from("sessions_cours")
        .update({
          ended_at: new Date().toISOString(),
          phase_fin: phaseCours,
          actif: false,
        })
        .eq("groupe_id", config.groupe_actif)
        .eq("actif", true)
    }

    await supabase
      .from("config")
      .update({
        groupe_actif: groupeId,
        en_cours: true,
      })
      .eq("id", 1)

    await ouvrirOuRecupererSession()

    return true
  }

  async function chargerEleves() {
    const { data, error } = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id", groupeId)
      .order("id")

    if (error) {
      console.error("ERREUR CHARGEMENT ELEVES:", error)
      return
    }

    const rows = (data as Eleve[]) || []

    const normalises = rows.map((e) => ({
      ...e,
      position_x: normaliserColonne(e.position_x),
      position_y: normaliserRangee(e.position_y),
      bravo_progress: e.bravo_progress ?? 0,
    }))

    setEleves(normalises)
  }

  async function chargerToilettesActives() {
    const { data, error } = await supabase
      .from("toilettes")
      .select("*")
      .eq("groupe_id", groupeId)
      .eq("actif", true)
      .order("slot", { ascending: true })

    if (error) {
      console.error("ERREUR CHARGEMENT TOILETTES:", error)
      return
    }

    setToilettesActives((data as ToiletteRecord[]) || [])
  }

  async function chargerContexte() {
    await Promise.all([
      chargerEleves(),
      chargerToilettesActives(),
      chargerConfig(),
    ])
  }

  useEffect(() => {
    async function init() {
      await chargerConfig()
      const ok = await entrerGroupe()
      if (ok) {
        await chargerContexte()
      }
    }
    init()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      chargerToilettesActives()
    }, 800)

    return () => clearInterval(interval)
  }, [groupeId])

  function normaliserColonne(value: number | null) {
    if (value === null || value === undefined) return 0
    if (value >= 0 && value <= GRID_COLS - 1) return Math.round(value)
    return 0
  }

  function normaliserRangee(value: number | null) {
    if (value === null || value === undefined) return GRID_ROWS - 1
    if (value >= 0 && value <= GRID_ROWS - 1) return Math.round(value)
    return GRID_ROWS - 1
  }

  async function sauvegarderToutesPositions() {
    for (const e of eleves) {
      await supabase
        .from("eleves")
        .update({
          position_x: normaliserColonne(e.position_x),
          position_y: normaliserRangee(e.position_y),
        })
        .eq("id", e.id)
    }
  }

  function pushUndoSnapshot(rows: Eleve[]) {
    const snapshot: UndoSnapshot = {
      rows: rows.map((r) => ({
        id: r.id,
        niveau: r.niveau,
        regle_manquement: r.regle_manquement,
        regle_retenue: r.regle_retenue,
        regle_retrait: r.regle_retrait,
        bravo_progress: r.bravo_progress ?? 0,
      })),
    }

    setUndoStack((prev) => [...prev, snapshot])
  }

  async function retourArriere() {
    const last = undoStack[undoStack.length - 1]
    if (!last) return

    for (const row of last.rows) {
      await supabase
        .from("eleves")
        .update({
          niveau: row.niveau,
          regle_manquement: row.regle_manquement,
          regle_retenue: row.regle_retenue,
          regle_retrait: row.regle_retrait,
          bravo_progress: row.bravo_progress,
        })
        .eq("id", row.id)
    }

    setEleves((prev) =>
      prev.map((el) => {
        const old = last.rows.find((r) => r.id === el.id)
        return old ? { ...el, ...old } : el
      })
    )

    setUndoStack((prev) => prev.slice(0, -1))
    setSelection(null)
    setMultiSelection([])
    setMultiReadyForRule(false)
    setRetraitDirect(false)
  }

  function buildUpdateNormal(e: Eleve, regle: number) {
    let nouveau = e.niveau + 1
    if (nouveau > 3) nouveau = 3

    const update: Partial<Eleve> = { niveau: nouveau, bravo_progress: 0 }

    if (nouveau === 1) update.regle_manquement = regle
    if (nouveau === 2) update.regle_retenue = regle
    if (nouveau === 3) update.regle_retrait = regle

    return update
  }

  function buildUpdateRetraitDirect(regle: number) {
    return {
      niveau: 3,
      regle_manquement: 0,
      regle_retenue: 0,
      regle_retrait: regle,
      bravo_progress: 0,
    }
  }

  function getActionType(params: {
    retraitDirectActif: boolean
    niveauApres: number
  }) {
    if (params.retraitDirectActif) return "retrait_direct" as const
    if (params.niveauApres === 1) return "manquement" as const
    if (params.niveauApres === 2) return "retenue" as const
    return "retrait" as const
  }

  async function appliquerReductionBravo(e: Eleve, newProgress: number) {
    if (e.niveau === 3 || e.niveau === 0) {
      const { error } = await supabase
        .from("eleves")
        .update({ bravo_progress: newProgress })
        .eq("id", e.id)

      if (!error) {
        setEleves((prev) =>
          prev.map((el) =>
            el.id === e.id ? { ...el, bravo_progress: newProgress } : el
          )
        )
      }
      return
    }

    if (newProgress < bravosParPalier) {
      const { error } = await supabase
        .from("eleves")
        .update({ bravo_progress: newProgress })
        .eq("id", e.id)

      if (!error) {
        setEleves((prev) =>
          prev.map((el) =>
            el.id === e.id ? { ...el, bravo_progress: newProgress } : el
          )
        )
      }
      return
    }

    if (e.niveau === 2) {
      const update = {
        niveau: 1,
        regle_retenue: 0,
        bravo_progress: 0,
      }

      const { error } = await supabase
        .from("eleves")
        .update(update)
        .eq("id", e.id)

      if (error) {
        console.error("ERREUR RETENUE RETIREE:", error)
        return
      }

      setEleves((prev) =>
        prev.map((el) => (el.id === e.id ? { ...el, ...update } : el))
      )

      await loggerAction({
        eleve_id: e.id,
        eleve_nom: e.nom,
        action_type: "retenue_retiree",
        niveau_avant: 2,
        niveau_apres: 1,
      })

      return
    }

    if (e.niveau === 1) {
      const update = {
        niveau: 0,
        regle_manquement: 0,
        bravo_progress: 0,
      }

      const { error } = await supabase
        .from("eleves")
        .update(update)
        .eq("id", e.id)

      if (error) {
        console.error("ERREUR MANQUEMENT RETIRE:", error)
        return
      }

      setEleves((prev) =>
        prev.map((el) => (el.id === e.id ? { ...el, ...update } : el))
      )

      await loggerAction({
        eleve_id: e.id,
        eleve_nom: e.nom,
        action_type: "manquement_retire",
        niveau_avant: 1,
        niveau_apres: 0,
      })
    }
  }

  async function donnerBravo(e: Eleve) {
    const progressActuel = e.bravo_progress ?? 0
    const nouveauProgress = progressActuel + 1

    await loggerAction({
      eleve_id: e.id,
      eleve_nom: e.nom,
      action_type: "bravo",
      niveau_avant: e.niveau,
      niveau_apres: e.niveau,
    })

    await appliquerReductionBravo(e, nouveauProgress)

    setSelection(null)
  }

  async function donnerBravoMultiple() {
    const cibles = eleves.filter((e) => multiSelection.includes(e.id))
    if (cibles.length === 0) return

    for (const e of cibles) {
      const progressActuel = e.bravo_progress ?? 0
      const nouveauProgress = progressActuel + 1

      await loggerAction({
        eleve_id: e.id,
        eleve_nom: e.nom,
        action_type: "bravo",
        niveau_avant: e.niveau,
        niveau_apres: e.niveau,
      })

      await appliquerReductionBravo(e, nouveauProgress)
    }

    setMultiSelection([])
    setMultiReadyForRule(false)
    setSelection(null)
  }

  async function appliquerRegle(e: Eleve, regle: number) {
    pushUndoSnapshot([e])

    const niveauAvant = e.niveau
    const update = retraitDirect
      ? buildUpdateRetraitDirect(regle)
      : buildUpdateNormal(e, regle)

    const niveauApres = update.niveau ?? e.niveau
    const actionType = getActionType({
      retraitDirectActif: retraitDirect,
      niveauApres,
    })

    setEleves((prev) =>
      prev.map((el) => (el.id === e.id ? { ...el, ...update } : el))
    )

    const { error } = await supabase
      .from("eleves")
      .update(update)
      .eq("id", e.id)

    if (error) {
      console.error("ERREUR appliquerRegle:", error)
    } else {
      await loggerAction({
        eleve_id: e.id,
        eleve_nom: e.nom,
        action_type: actionType,
        regle,
        niveau_avant: niveauAvant,
        niveau_apres: niveauApres,
      })
    }

    setSelection(null)
    setRetraitDirect(false)
  }

  async function appliquerRegleMultiple(regle: number) {
    const cibles = eleves.filter((e) => multiSelection.includes(e.id))
    if (cibles.length === 0) return

    pushUndoSnapshot(cibles)

    const updates = cibles.map((e) => {
      const update = retraitDirect
        ? buildUpdateRetraitDirect(regle)
        : buildUpdateNormal(e, regle)

      const niveauAvant = e.niveau
      const niveauApres = update.niveau ?? e.niveau
      const actionType = getActionType({
        retraitDirectActif: retraitDirect,
        niveauApres,
      })

      return {
        eleve: e,
        update,
        niveauAvant,
        niveauApres,
        actionType,
      }
    })

    setEleves((prev) =>
      prev.map((el) => {
        const match = updates.find((u) => u.eleve.id === el.id)
        return match ? { ...el, ...match.update } : el
      })
    )

    for (const item of updates) {
      const { error } = await supabase
        .from("eleves")
        .update(item.update)
        .eq("id", item.eleve.id)

      if (error) {
        console.error("ERREUR appliquerRegleMultiple:", error)
      } else {
        await loggerAction({
          eleve_id: item.eleve.id,
          eleve_nom: item.eleve.nom,
          action_type: item.actionType,
          regle,
          niveau_avant: item.niveauAvant,
          niveau_apres: item.niveauApres,
        })
      }
    }

    setMultiSelection([])
    setMultiReadyForRule(false)
    setSelection(null)
    setRetraitDirect(false)
  }

  async function envoyerAuxToilettes(e: Eleve) {
    const { data: allRows, error: loadError } = await supabase
      .from("toilettes")
      .select("*")
      .eq("groupe_id", groupeId)
      .order("created_at", { ascending: true })

    if (loadError) {
      console.error("ERREUR LOAD TOILETTES:", loadError)
      alert("Erreur toilettes")
      return
    }

    const toutes = (allRows as ToiletteRecord[]) || []

    const dejaActif = toutes.find((t) => t.actif && t.eleve_id === e.id)
    if (dejaActif) {
      await chargerToilettesActives()
      setSelection(e.id)
      return
    }

    const slotsDejaUtilises = new Set(toutes.map((t) => t.slot))
    let slotChoisi: number | undefined = [1, 2].find(
      (slot) => !slotsDejaUtilises.has(slot)
    )

    if (!slotChoisi) {
      const actives = toutes.filter((t) => t.actif)
      slotChoisi = [1, 2].find(
        (slot) => !actives.some((t) => t.slot === slot)
      )
    }

    if (!slotChoisi) {
      alert(
        "Les deux emplacements toilettes sont déjà utilisés pour cette période. Clique sur QUITTER pour repartir à neuf."
      )
      await chargerToilettesActives()
      return
    }

    const { error } = await supabase.from("toilettes").insert([
      {
        groupe_id: groupeId,
        eleve_id: e.id,
        eleve_nom: e.nom,
        slot: slotChoisi,
        actif: true,
      },
    ])

    if (error) {
      console.error("ERREUR ENVOI TOILETTES:", error)
      alert("Erreur envoi toilettes")
      return
    }

    await loggerAction({
      eleve_id: e.id,
      eleve_nom: e.nom,
      action_type: "toilettes_depart",
      niveau_avant: e.niveau,
      niveau_apres: e.niveau,
    })

    await chargerToilettesActives()
    setSelection(e.id)
  }

  async function retourDesToilettes(e: Eleve) {
    const record = toilettesActives.find(
      (t) => t.actif && t.eleve_id === e.id
    )

    if (!record) return

    const endedAt = new Date().toISOString()
    const dureeSecondes = Math.max(
      0,
      Math.round((Date.now() - new Date(record.started_at).getTime()) / 1000)
    )

    const { error } = await supabase
      .from("toilettes")
      .update({
        actif: false,
        ended_at: endedAt,
        duree_secondes: dureeSecondes,
      })
      .eq("id", record.id)

    if (error) {
      console.error("ERREUR RETOUR TOILETTES:", error)
      alert("Erreur retour toilettes")
      return
    }

    await chargerToilettesActives()
    setSelection(e.id)
  }

  async function quitterGroupe() {
    await sauvegarderToutesPositions()
    await viderToilettesDuGroupe(groupeId)

    await supabase
      .from("eleves")
      .update({
        niveau: 0,
        regle_manquement: 0,
        regle_retenue: 0,
        regle_retrait: 0,
        bravo_progress: 0,
      })
      .eq("groupe_id", groupeId)

    await supabase
  .from("config")
  .update({
    groupe_actif: null,
    en_cours: false,
    phase_cours: "modelage",
    ecran_mode: "colonnes",
  })
      .eq("id", 1)

    await fermerSession()

    setEleves((prev) =>
      prev.map((e) => ({
        ...e,
        niveau: 0,
        regle_manquement: 0,
        regle_retenue: 0,
        regle_retrait: 0,
        bravo_progress: 0,
      }))
    )

    setSelection(null)
    setEditMode(false)
    setDraggingId(null)
    setMultiMode(false)
    setMultiSelection([])
    setMultiReadyForRule(false)
    setRetraitDirect(false)
    setUndoStack([])
    setToilettesActives([])
    setPhaseCours("modelage")
    setEcranMode("colonnes")
  }

  function couleur(niveau: number) {
    if (niveau === 0) return "bg-blue-500 text-black"
    if (niveau === 1) return "bg-yellow-400 text-black"
    if (niveau === 2) return "bg-orange-500 text-black"
    return "bg-red-600 text-white"
  }

  function toggleMultiSelection(id: number) {
    setMultiSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function annulerMulti() {
    setMultiSelection([])
    setMultiReadyForRule(false)
    setSelection(null)
  }

  function startLongPress() {
    if (multiMode) return

    longPressTimer.current = setTimeout(() => {
      setEditMode(true)
      setSelection(null)
    }, 500)
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
  }

  function pointerToCell(clientX: number, clientY: number) {
    if (!boardRef.current) {
      return { col: 0, row: 0 }
    }

    const rect = boardRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const studentHeight = rect.height * (1 - TEACHER_ZONE_RATIO)

    const col = clamp(
      Math.floor(x / (rect.width / GRID_COLS)),
      0,
      GRID_COLS - 1
    )

    const row = clamp(
      Math.floor(y / (studentHeight / GRID_ROWS)),
      0,
      GRID_ROWS - 1
    )

    return { col, row }
  }

  async function startDrag(clientX: number, clientY: number, eleveId: number) {
    if (!editMode) return

    setDraggingId(eleveId)

    const { col, row } = pointerToCell(clientX, clientY)

    setEleves((prev) =>
      prev.map((e) =>
        e.id === eleveId ? { ...e, position_x: col, position_y: row } : e
      )
    )
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!editMode || draggingId === null) return

    const { col, row } = pointerToCell(clientX, clientY)

    setEleves((prev) =>
      prev.map((e) =>
        e.id === draggingId ? { ...e, position_x: col, position_y: row } : e
      )
    )
  }

  async function endDrag() {
    if (draggingId === null) return

    const eleve = eleves.find((e) => e.id === draggingId)
    if (eleve) {
      await supabase
        .from("eleves")
        .update({
          position_x: normaliserColonne(eleve.position_x),
          position_y: normaliserRangee(eleve.position_y),
        })
        .eq("id", eleve.id)
    }

    setDraggingId(null)
  }

  const cellWidth = boardSize.width / GRID_COLS
  const studentAreaHeightPx = boardSize.height * (1 - TEACHER_ZONE_RATIO)
  const cellHeight = studentAreaHeightPx / GRID_ROWS

  const bubbleWidth = Math.max(34, Math.min(46, cellWidth - 6))
  const bubbleHeight = Math.max(24, Math.min(34, cellHeight - 6))
  const bubbleFontSize = Math.max(9, Math.min(12, bubbleWidth * 0.23))

  const showActionBar = !!selectedEleve && !multiMode

  function phaseLabel(phase: PhaseCours) {
    if (phase === "pratique_guidee") return "Pratique guidée"
    if (phase === "pratique_autonome") return "Pratique autonome"
    return "Modelage"
  }

  const baseBtn =
    "px-3 py-2 rounded-2xl text-sm active:scale-[0.97] transition-transform duration-100"

  const actionBtn =
    "px-3 py-1.5 rounded-xl text-sm active:scale-95 transition-all duration-100 shadow-sm"

  return (
    <div className="min-h-screen bg-white px-3 py-3">
      <div className="mx-auto w-full max-w-[430px]">
        <h1 className="text-2xl font-bold mb-2">Groupe {groupeId}</h1>

        <div className="flex flex-wrap gap-2 mb-2">
  <button
    onClick={quitterGroupe}
    className={`bg-red-700 text-white ${baseBtn}`}
  >
    QUITTER
  </button>

  <button
    onClick={retourArriere}
    disabled={undoStack.length === 0}
    className={`${baseBtn} ${
      undoStack.length === 0
        ? "bg-gray-400 text-white opacity-70"
        : "bg-black text-white"
    }`}
  >
    RETOUR
  </button>

  <button
    onClick={() => {
      const next = !multiMode
      setMultiMode(next)
      setMultiSelection([])
      setMultiReadyForRule(false)
      setSelection(null)
      setRetraitDirect(false)
    }}
    className={`${baseBtn} ${
      multiMode ? "bg-purple-700 text-white" : "bg-gray-300 text-black"
    }`}
  >
    MULTIPLE
  </button>

  <button
    onClick={() => {
      setRetraitDirect(!retraitDirect)
      setSelection(null)
      setMultiReadyForRule(false)
    }}
    className={`${baseBtn} ${
      retraitDirect ? "bg-red-800 text-white" : "bg-gray-300 text-black"
    }`}
  >
    RETRAIT DIRECT
  </button>

  <button
    onClick={() => changerEcranMode("ratio")}
    className={`${baseBtn} ${
      ecranMode === "ratio"
        ? "bg-indigo-700 text-white"
        : "bg-gray-300 text-black"
    }`}
  >
    RATIO 📊
  </button>

  {ecranMode === "ratio" && (
    <button
      onClick={() => changerEcranMode("colonnes")}
      className={`bg-indigo-500 text-white ${baseBtn}`}
    >
      RETOUR ÉCRAN
    </button>
  )}

  {selectedEleve && toiletteActiveSelection && (
    <button
      onClick={() => retourDesToilettes(selectedEleve)}
      className={`bg-emerald-600 text-white ${baseBtn}`}
    >
      REVENU 🚽
    </button>
  )}
</div>

        <div className="mt-3 mb-3 rounded-2xl border border-gray-200 bg-white p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">
            Réglages bravo
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Bravos / palier
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={bravosParPalier}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  setBravosParPalier(value)
                }}
                onBlur={() =>
                  sauvegarderParametresBravo({ bravos_par_palier: bravosParPalier })
                }
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Affichage bravo (sec.)
              </label>
              <input
                type="number"
                min={3}
                max={300}
                value={bravoDisplaySeconds}
                onChange={(e) => {
                  const value = Math.max(3, Math.min(300, Number(e.target.value) || 3))
                  setBravoDisplaySeconds(value)
                }}
                onBlur={() =>
                  sauvegarderParametresBravo({
                    bravo_display_seconds: bravoDisplaySeconds,
                  })
                }
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {showActionBar && (
          <div className="flex items-center flex-wrap gap-2 mb-2 rounded-2xl bg-gray-100 px-3 py-2">
            <div className="text-sm font-medium w-full">
              {selectedEleve?.nom}
            </div>

            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                className={`bg-black text-white ${actionBtn}`}
                onClick={() => {
                  if (selectedEleve) appliquerRegle(selectedEleve, r)
                }}
              >
                #{r}
              </button>
            ))}

            <button
              className={`bg-green-600 text-white text-lg ${actionBtn}`}
              onClick={() => {
                if (selectedEleve) donnerBravo(selectedEleve)
              }}
              title="Donner un bravo"
            >
              👍
            </button>

            <button
              className={`bg-sky-600 text-white text-lg ${actionBtn}`}
              onClick={() => {
                if (selectedEleve) envoyerAuxToilettes(selectedEleve)
              }}
              title="Envoyer aux toilettes"
            >
              🚽
            </button>
          </div>
        )}

        {multiMode && !multiReadyForRule && (
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <button
              onClick={() => {
                if (multiSelection.length === 0) return
                setMultiReadyForRule(true)
                setSelection(null)
              }}
              disabled={multiSelection.length === 0}
              className={`${baseBtn} ${
                multiSelection.length === 0
                  ? "bg-green-300 text-white opacity-70"
                  : "bg-green-700 text-white"
              }`}
            >
              OK ({multiSelection.length})
            </button>

            <button
              onClick={annulerMulti}
              className={`bg-gray-500 text-white ${baseBtn}`}
            >
              ANNULER
            </button>
          </div>
        )}

        {multiMode && multiReadyForRule && (
          <div className="flex items-center flex-wrap gap-2 mb-2 rounded-2xl bg-gray-100 px-3 py-2">
            <div className="text-sm font-medium w-full">
              {multiSelection.length} élève{multiSelection.length > 1 ? "s" : ""}
            </div>

            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                className={`bg-black text-white ${actionBtn}`}
                onClick={() => appliquerRegleMultiple(r)}
              >
                #{r}
              </button>
            ))}

            <button
              className={`bg-green-600 text-white text-lg ${actionBtn}`}
              onClick={donnerBravoMultiple}
              title="Donner un bravo"
            >
              👍
            </button>
          </div>
        )}

        <div
          ref={boardRef}
          className="relative w-full rounded-[28px] border-2 border-gray-700 bg-gray-100 overflow-hidden"
          style={{
            aspectRatio: "7 / 5.6",
            touchAction: "none",
          }}
          onClick={() => {
            setSelection(null)
            if (draggingId === null) {
              setEditMode(false)
            }
          }}
          onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchMove={(e) => {
            const touch = e.touches[0]
            if (touch) moveDrag(touch.clientX, touch.clientY)
          }}
          onTouchEnd={endDrag}
        >
          <div
            className="absolute left-0 top-0 w-full"
            style={{ height: `${studentAreaPercent}%` }}
          >
            <div className="grid h-full w-full grid-cols-7 grid-rows-5">
              {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => (
                <div key={i} className="border border-gray-300" />
              ))}
            </div>
          </div>

          <div
            className="absolute left-0 bottom-0 w-full flex items-center justify-center"
            style={{ height: `${TEACHER_ZONE_RATIO * 100}%` }}
          >
            <div className="bg-slate-800 text-white text-xs px-4 py-2 rounded-2xl shadow">
              Bureau du prof
            </div>
          </div>

          {eleves.map((e) => {
            const col = normaliserColonne(e.position_x)
            const row = normaliserRangee(e.position_y)

            const centerXPercent = ((col + 0.5) / GRID_COLS) * 100
            const centerYPercent = ((row + 0.5) / GRID_ROWS) * studentAreaPercent

            const isSelected = selection === e.id
            const isMultiSelected = multiSelection.includes(e.id)

            return (
              <div
                key={e.id}
                className="absolute"
                style={{
                  left: `${centerXPercent}%`,
                  top: `${centerYPercent}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onMouseDown={(ev) => {
                  ev.stopPropagation()

                  if (editMode) {
                    startDrag(ev.clientX, ev.clientY, e.id)
                  } else {
                    startLongPress()
                  }
                }}
                onMouseUp={cancelLongPress}
                onTouchStart={(ev) => {
                  ev.stopPropagation()

                  const touch = ev.touches[0]
                  if (!touch) return

                  if (editMode) {
                    startDrag(touch.clientX, touch.clientY, e.id)
                  } else {
                    startLongPress()
                  }
                }}
                onTouchEnd={cancelLongPress}
              >
                <button
                  className={[
                    "rounded-2xl shadow-md font-medium leading-none text-center transition-all active:scale-95",
                    couleur(e.niveau),
                    editMode ? "ring-2 ring-black" : "",
                    isSelected ? "ring-4 ring-black" : "",
                    isMultiSelected ? "ring-4 ring-purple-600" : "",
                  ].join(" ")}
                  style={{
                    width: `${bubbleWidth}px`,
                    minHeight: `${bubbleHeight}px`,
                    fontSize: `${bubbleFontSize}px`,
                    padding: "3px 4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation()

                    if (editMode) return

                    if (multiMode) {
                      toggleMultiSelection(e.id)
                      return
                    }

                    setSelection(e.id)
                  }}
                >
                  {e.nom}
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">
            Section du cours
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "modelage", label: "Modelage" },
              { value: "pratique_guidee", label: "Pratique guidée" },
              { value: "pratique_autonome", label: "Pratique autonome" },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => choisirPhase(item.value as PhaseCours)}
                className={`rounded-xl px-2 py-2 text-xs font-semibold active:scale-95 transition-transform ${
                  phaseCours === item.value
                    ? "bg-indigo-700 text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            En cours : {phaseLabel(phaseCours)}
          </div>
        </div>

        {toilettesActives.length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            Toilettes en cours :{" "}
            {toilettesActives
              .map((t) => `${t.eleve_nom} (🚽${t.slot})`)
              .join(" • ")}
          </div>
        )}

        {editMode && (
          <div className="mt-2 text-xs text-gray-600">
            Mode placement activé : glisse les élèves. Touche à l’extérieur pour quitter.
          </div>
        )}
      </div>
    </div>
  )
}
