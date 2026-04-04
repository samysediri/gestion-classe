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
}

type UndoRow = {
  id: number
  niveau: number
  regle_manquement: number
  regle_retenue: number
  regle_retrait: number
}

type UndoSnapshot = {
  rows: UndoRow[]
}

const GRID_COLS = 7
const GRID_ROWS = 5
const TEACHER_ZONE_RATIO = 0.12 // portion du bas réservée au bureau du prof

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

  const [boardSize, setBoardSize] = useState({ width: 320, height: 240 })

  const boardRef = useRef<HTMLDivElement | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedEleve = useMemo(
    () => eleves.find((e) => e.id === selection) || null,
    [eleves, selection]
  )

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

  async function entrerGroupe() {
    const { data } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .single()

    if (data?.en_cours && data.groupe_actif !== groupeId) {
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
        })
        .eq("groupe_id", data.groupe_actif)
    }

    await supabase
      .from("config")
      .update({
        groupe_actif: groupeId,
        en_cours: true,
      })
      .eq("id", 1)

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

    // Si d’anciennes positions en pixels traînent encore, on les ramène dans la grille.
    const normalises = rows.map((e) => ({
      ...e,
      position_x: normaliserColonne(e.position_x),
      position_y: normaliserRangee(e.position_y),
    }))

    setEleves(normalises)
  }

  useEffect(() => {
    async function init() {
      const ok = await entrerGroupe()
      if (ok) {
        await chargerEleves()
      }
    }
    init()
  }, [])

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

  function pushUndoSnapshot(rows: Eleve[]) {
    const snapshot: UndoSnapshot = {
      rows: rows.map((r) => ({
        id: r.id,
        niveau: r.niveau,
        regle_manquement: r.regle_manquement,
        regle_retenue: r.regle_retenue,
        regle_retrait: r.regle_retrait,
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

    const update: Partial<Eleve> = { niveau: nouveau }

    if (nouveau === 1) {
      update.regle_manquement = regle
    }

    if (nouveau === 2) {
      update.regle_retenue = regle
    }

    if (nouveau === 3) {
      update.regle_retrait = regle
    }

    return update
  }

  function buildUpdateRetraitDirect(regle: number) {
    return {
      niveau: 3,
      regle_manquement: 0,
      regle_retenue: 0,
      regle_retrait: regle,
    }
  }

  async function appliquerRegle(e: Eleve, regle: number) {
    pushUndoSnapshot([e])

    const update = retraitDirect
      ? buildUpdateRetraitDirect(regle)
      : buildUpdateNormal(e, regle)

    setEleves((prev) =>
      prev.map((el) => (el.id === e.id ? { ...el, ...update } : el))
    )

    const { error } = await supabase
      .from("eleves")
      .update(update)
      .eq("id", e.id)

    if (error) {
      console.error("ERREUR appliquerRegle:", error)
    }

    setSelection(null)
    setRetraitDirect(false)
  }

  async function appliquerRegleMultiple(regle: number) {
    const cibles = eleves.filter((e) => multiSelection.includes(e.id))
    if (cibles.length === 0) return

    pushUndoSnapshot(cibles)

    const updates = cibles.map((e) => ({
      id: e.id,
      update: retraitDirect
        ? buildUpdateRetraitDirect(regle)
        : buildUpdateNormal(e, regle),
    }))

    setEleves((prev) =>
      prev.map((el) => {
        const match = updates.find((u) => u.id === el.id)
        return match ? { ...el, ...match.update } : el
      })
    )

    for (const item of updates) {
      const { error } = await supabase
        .from("eleves")
        .update(item.update)
        .eq("id", item.id)

      if (error) {
        console.error("ERREUR appliquerRegleMultiple:", error)
      }
    }

    setMultiSelection([])
    setMultiReadyForRule(false)
    setSelection(null)
    setRetraitDirect(false)
  }

  async function quitterGroupe() {
    await supabase
      .from("eleves")
      .update({
        niveau: 0,
        regle_manquement: 0,
        regle_retenue: 0,
        regle_retrait: 0,
      })
      .eq("groupe_id", groupeId)

    await supabase
      .from("config")
      .update({
        groupe_actif: null,
        en_cours: false,
      })
      .eq("id", 1)

    setSelection(null)
    setEditMode(false)
    setDraggingId(null)
    setMultiMode(false)
    setMultiSelection([])
    setMultiReadyForRule(false)
    setRetraitDirect(false)
    setUndoStack([])
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

  const showRuleBar = (!!selectedEleve && !multiMode) || multiReadyForRule

  return (
    <div className="min-h-screen bg-white px-3 py-3">
      <div className="mx-auto w-full max-w-[430px]">
        <h1 className="text-2xl font-bold mb-2">Groupe {groupeId}</h1>

        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={quitterGroupe}
            className="bg-red-700 text-white px-3 py-2 rounded-2xl text-sm"
          >
            QUITTER
          </button>

          <button
            onClick={retourArriere}
            disabled={undoStack.length === 0}
            className={`px-3 py-2 rounded-2xl text-sm ${
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
            className={`px-3 py-2 rounded-2xl text-sm ${
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
            className={`px-3 py-2 rounded-2xl text-sm ${
              retraitDirect ? "bg-red-800 text-white" : "bg-gray-300 text-black"
            }`}
          >
            RETRAIT DIRECT
          </button>

          {multiMode && !multiReadyForRule && (
            <button
              onClick={() => {
                if (multiSelection.length === 0) return
                setMultiReadyForRule(true)
                setSelection(null)
              }}
              disabled={multiSelection.length === 0}
              className={`px-3 py-2 rounded-2xl text-sm ${
                multiSelection.length === 0
                  ? "bg-green-300 text-white opacity-70"
                  : "bg-green-700 text-white"
              }`}
            >
              OK ({multiSelection.length})
            </button>
          )}

          {multiMode && (
            <button
              onClick={annulerMulti}
              className="bg-gray-500 text-white px-3 py-2 rounded-2xl text-sm"
            >
              ANNULER
            </button>
          )}
        </div>

        {showRuleBar && (
          <div className="flex items-center flex-wrap gap-2 mb-2 rounded-2xl bg-gray-100 px-3 py-2">
            <div className="text-sm font-medium">
              {multiReadyForRule
                ? `${multiSelection.length} élève${
                    multiSelection.length > 1 ? "s" : ""
                  }`
                : selectedEleve?.nom}
            </div>

            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                className="bg-black text-white px-3 py-1.5 rounded-xl text-sm"
                onClick={() => {
                  if (multiReadyForRule) {
                    appliquerRegleMultiple(r)
                  } else if (selectedEleve) {
                    appliquerRegle(selectedEleve, r)
                  }
                }}
              >
                #{r}
              </button>
            ))}
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
          {/* zone bureaux élèves */}
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

          {/* bureau du prof, zone stable et cohérente */}
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
                    "rounded-2xl shadow-md font-medium leading-none text-center",
                    "transition-all",
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

        {editMode && (
          <div className="mt-2 text-xs text-gray-600">
            Mode placement activé : glisse les élèves. Touche à l’extérieur pour quitter.
          </div>
        )}
      </div>
    </div>
  )
}
