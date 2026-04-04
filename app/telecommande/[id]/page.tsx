"use client"

import { useEffect, useRef, useState } from "react"
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
  tempX?: number
  tempY?: number
}

type UndoSnapshot = {
  rows: Array<{
    id: number
    niveau: number
    regle_manquement: number
    regle_retenue: number
    regle_retrait: number
  }>
}

export default function Page() {
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [selection, setSelection] = useState<number | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [dragging, setDragging] = useState<Eleve | null>(null)

  const [multiMode, setMultiMode] = useState(false)
  const [multiSelection, setMultiSelection] = useState<number[]>([])
  const [multiReadyForRule, setMultiReadyForRule] = useState(false)

  const [retraitDirect, setRetraitDirect] = useState(false)

  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])

  const dragOffset = useRef({ x: 0, y: 0 })
  const longPressTimer = useRef<any>(null)

  const params = useParams()
  const groupeId = Number(params.id)

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

    setEleves((data as Eleve[]) || [])
  }

  async function updatePosition(id: number, x: number, y: number) {
    await supabase
      .from("eleves")
      .update({ position_x: x, position_y: y })
      .eq("id", id)
  }

  async function sauvegarderToutesPositions() {
    for (const e of eleves) {
      await supabase
        .from("eleves")
        .update({
          position_x: e.tempX ?? e.position_x ?? 0,
          position_y: e.tempY ?? e.position_y ?? 0,
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

    const update = buildUpdateNormal(e, regle)

    setEleves((prev) =>
      prev.map((el) => (el.id === e.id ? { ...el, ...update } : el))
    )

    const { error } = await supabase.from("eleves").update(update).eq("id", e.id)

    if (error) {
      console.error("ERREUR appliquerRegle:", error)
    }

    setSelection(null)
  }

  async function appliquerRetraitDirect(e: Eleve, regle: number) {
    pushUndoSnapshot([e])

    const update = buildUpdateRetraitDirect(regle)

    setEleves((prev) =>
      prev.map((el) => (el.id === e.id ? { ...el, ...update } : el))
    )

    const { error } = await supabase.from("eleves").update(update).eq("id", e.id)

    if (error) {
      console.error("ERREUR appliquerRetraitDirect:", error)
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
    await sauvegarderToutesPositions()

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
    setMultiMode(false)
    setMultiSelection([])
    setMultiReadyForRule(false)
    setRetraitDirect(false)
    setUndoStack([])
  }

  useEffect(() => {
    async function init() {
      const ok = await entrerGroupe()
      if (ok) {
        chargerEleves()
      }
    }
    init()
  }, [])

  function couleur(niveau: number) {
    if (niveau === 0) return "bg-blue-500"
    if (niveau === 1) return "bg-yellow-500 text-black"
    if (niveau === 2) return "bg-orange-500 text-black"
    return "bg-red-600"
  }

  function startLongPress() {
    longPressTimer.current = setTimeout(() => {
      setEditMode(true)
      setSelection(null)
    }, 600)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current)
  }

  function startDrag(e: Eleve, clientX: number, clientY: number) {
    const rect = document.getElementById("btn-" + e.id)?.getBoundingClientRect()
    if (!rect) return

    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }

    setDragging(e)
  }

  function handleMove(clientX: number, clientY: number, container: any) {
    if (!dragging) return

    const rect = container.getBoundingClientRect()

    const x = clientX - rect.left - dragOffset.current.x
    const y = clientY - rect.top - dragOffset.current.y

    setEleves((prev) =>
      prev.map((el) =>
        el.id === dragging.id
          ? { ...el, tempX: Math.max(0, x), tempY: Math.max(0, y) }
          : el
      )
    )
  }

  function handleEnd() {
    if (dragging) {
      const el = eleves.find((e) => e.id === dragging.id)

      if (el) {
        updatePosition(
          el.id,
          el.tempX ?? el.position_x ?? 0,
          el.tempY ?? el.position_y ?? 0
        )
      }

      setDragging(null)
    }
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

  return (
    <div className="p-3 sm:p-4 h-screen overflow-hidden select-none bg-white">
      <h1 className="text-xl sm:text-2xl font-semibold mb-3">Groupe {groupeId}</h1>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={quitterGroupe}
          className="bg-red-700 text-white px-3 py-2 rounded-xl text-sm"
        >
          QUITTER
        </button>

        <button
          onClick={retourArriere}
          className="bg-black text-white px-3 py-2 rounded-xl text-sm disabled:opacity-40"
          disabled={undoStack.length === 0}
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
          }}
          className={`px-3 py-2 rounded-xl text-sm ${
            multiMode ? "bg-purple-700 text-white" : "bg-gray-300"
          }`}
        >
          MULTIPLE
        </button>

        <button
          onClick={() => {
            setRetraitDirect(!retraitDirect)
            setSelection(null)
          }}
          className={`px-3 py-2 rounded-xl text-sm ${
            retraitDirect ? "bg-red-800 text-white" : "bg-gray-300"
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
            className="bg-green-700 text-white px-3 py-2 rounded-xl text-sm disabled:opacity-40"
            disabled={multiSelection.length === 0}
          >
            OK ({multiSelection.length})
          </button>
        )}

        {multiMode && (
          <button
            onClick={annulerMulti}
            className="bg-gray-500 text-white px-3 py-2 rounded-xl text-sm"
          >
            ANNULER MULTI
          </button>
        )}
      </div>

      {multiMode && multiReadyForRule && (
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <div className="text-sm font-medium mr-2">
            Règle pour {multiSelection.length} élève{multiSelection.length > 1 ? "s" : ""}
          </div>

          {[1, 2, 3, 4].map((r) => (
            <button
              key={r}
              className="bg-black text-white px-3 py-2 rounded-lg text-sm"
              onClick={() => appliquerRegleMultiple(r)}
            >
              #{r}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative w-full h-[78vh] bg-gray-100 border rounded-2xl overflow-hidden"
        style={{ touchAction: "none" }}
        onClick={() => {
          setSelection(null)
          if (!dragging) setEditMode(false)
        }}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY, e.currentTarget)}
        onMouseUp={handleEnd}
        onTouchMove={(e) => {
          const touch = e.touches[0]
          handleMove(touch.clientX, touch.clientY, e.currentTarget)
        }}
        onTouchEnd={handleEnd}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="grid grid-cols-7 grid-rows-5 w-full h-full">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="border border-gray-300" />
            ))}
          </div>
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-4 py-2 rounded-xl shadow">
          Bureau du prof
        </div>

        {eleves.map((e) => {
          const x = e.tempX ?? e.position_x ?? 0
          const y = e.tempY ?? e.position_y ?? 0

          const isSelected = selection === e.id
          const isMultiSelected = multiSelection.includes(e.id)

          return (
            <div
              key={e.id}
              style={{ position: "absolute", left: x, top: y }}
              onMouseDown={(ev) => {
                if (editMode) {
                  startDrag(e, ev.clientX, ev.clientY)
                } else {
                  startLongPress()
                }
              }}
              onTouchStart={(ev) => {
                const touch = ev.touches[0]
                if (editMode) {
                  startDrag(e, touch.clientX, touch.clientY)
                } else {
                  startLongPress()
                }
              }}
              onMouseUp={cancelLongPress}
              onTouchEnd={cancelLongPress}
            >
              <button
                id={"btn-" + e.id}
                className={[
                  couleur(e.niveau),
                  "rounded-xl shadow-sm text-[11px] sm:text-xs leading-tight",
                  "px-2 py-2 min-w-[58px] max-w-[78px]",
                  "whitespace-normal break-words text-center",
                  editMode ? "animate-pulse" : "",
                  isMultiSelected ? "ring-4 ring-purple-500" : "",
                  isSelected ? "ring-4 ring-black" : "",
                ].join(" ")}
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

              {selection === e.id && !editMode && !multiMode && (
                <div className="flex gap-1 mt-1 flex-wrap max-w-[110px]">
                  {[1, 2, 3, 4].map((r) => (
                    <button
                      key={r}
                      className="bg-black text-white px-2 py-1 rounded-lg text-xs"
                      onClick={(ev) => {
                        ev.stopPropagation()

                        if (retraitDirect) {
                          appliquerRetraitDirect(e, r)
                        } else {
                          appliquerRegle(e, r)
                        }
                      }}
                    >
                      #{r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
