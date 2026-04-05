"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../../../lib/supabase"
import { useParams } from "next/navigation"

type Eleve = {
  id: number
  nom: string
  niveau: number
  groupe_id: number
  position_x: number | null
  position_y: number | null
}

type UndoRow = {
  id: number
  niveau: number
}

type UndoSnapshot = {
  rows: UndoRow[]
}

export default function Page() {
  const params = useParams()
  const groupeId = Number(params.id)

  const [eleves, setEleves] = useState<Eleve[]>([])
  const [selection, setSelection] = useState<number | null>(null)

  const [multiMode, setMultiMode] = useState(false)
  const [multiSelection, setMultiSelection] = useState<number[]>([])
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])

  const selectedEleve = useMemo(
    () => eleves.find((e) => e.id === selection) || null,
    [eleves, selection]
  )

  async function chargerEleves() {
    const { data } = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id", groupeId)

    setEleves((data ?? []) as Eleve[])
  }

  useEffect(() => {
    chargerEleves()
    const interval = setInterval(chargerEleves, 800)
    return () => clearInterval(interval)
  }, [])

  function pushUndo(rows: Eleve[]) {
    setUndoStack((prev) => [
      ...prev,
      { rows: rows.map((r) => ({ id: r.id, niveau: r.niveau })) },
    ])
  }

  async function retourArriere() {
    const last = undoStack[undoStack.length - 1]
    if (!last) return

    for (const row of last.rows) {
      await supabase
        .from("eleves")
        .update({ niveau: row.niveau })
        .eq("id", row.id)
    }

    setUndoStack((prev) => prev.slice(0, -1))
    chargerEleves()
  }

  async function setStatut(e: Eleve, niveau: number) {
    pushUndo([e])

    await supabase
      .from("eleves")
      .update({ niveau })
      .eq("id", e.id)

    setSelection(null)
    chargerEleves()
  }

  async function setStatutMultiple(niveau: number) {
    const cibles = eleves.filter((e) => multiSelection.includes(e.id))
    if (cibles.length === 0) return

    pushUndo(cibles)

    for (const e of cibles) {
      await supabase
        .from("eleves")
        .update({ niveau })
        .eq("id", e.id)
    }

    setMultiSelection([])
    chargerEleves()
  }

  function toggleMulti(id: number) {
    setMultiSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function couleur(niveau: number) {
    if (niveau === 0) return "bg-green-500"
    if (niveau === 1) return "bg-yellow-400"
    if (niveau === 2) return "bg-orange-500"
    return "bg-red-600"
  }

  return (
    <div className="p-4 max-w-md mx-auto">

      <h1 className="text-xl font-bold mb-3">Groupe {groupeId}</h1>

      {/* CONTROLES */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={retourArriere}
          className="bg-black text-white px-3 py-2 rounded"
        >
          RETOUR
        </button>

        <button
          onClick={() => setMultiMode(!multiMode)}
          className="bg-purple-600 text-white px-3 py-2 rounded"
        >
          MULTI
        </button>
      </div>

      {/* ACTIONS */}
      {selectedEleve && !multiMode && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => setStatut(selectedEleve, 0)}>🟢</button>
          <button onClick={() => setStatut(selectedEleve, 1)}>⚪</button>
          <button onClick={() => setStatut(selectedEleve, 2)}>🟠</button>
          <button onClick={() => setStatut(selectedEleve, 3)}>🔴</button>
        </div>
      )}

      {multiMode && multiSelection.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => setStatutMultiple(0)}>🟢</button>
          <button onClick={() => setStatutMultiple(1)}>⚪</button>
          <button onClick={() => setStatutMultiple(2)}>🟠</button>
          <button onClick={() => setStatutMultiple(3)}>🔴</button>
        </div>
      )}

      {/* LISTE */}
      <div className="grid grid-cols-3 gap-2">
        {eleves.map((e) => (
          <button
            key={e.id}
            onClick={() =>
              multiMode ? toggleMulti(e.id) : setSelection(e.id)
            }
            className={`${couleur(e.niveau)} text-white p-3 rounded`}
          >
            {e.nom}
          </button>
        ))}
      </div>
    </div>
  )
}
