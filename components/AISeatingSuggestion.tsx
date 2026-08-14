"use client"

import { useState } from "react"
import { supabase } from "../lib/supabase"

type Snapshot = {
  session_id: number
  groupe_id: number
  eleve_id: number
  eleve_nom: string
  position_x: number | null
  position_y: number | null
}

type Log = {
  session_id: number
  eleve_id: number
  eleve_nom: string
  action_type: string
  phase_cours: string | null
  created_at: string
}

type Session = { id: number; groupe_id: number }

type AIResult = {
  confidence: "faible" | "moderee" | "elevee"
  summary: string
  limitations: string[]
  moves: { student: string; x: number; y: number; reason: string }[]
  signals: { title: string; explanation: string; strength: "faible" | "moderee" | "forte" }[]
}

export default function AISeatingSuggestion({ groupId, sessionId }: { groupId: number; sessionId: number }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<AIResult | null>(null)
  const [basePlan, setBasePlan] = useState<Snapshot[]>([])
  const [keyToName, setKeyToName] = useState<Record<string, string>>({})

  async function analyze() {
    setLoading(true)
    setError("")
    setResult(null)

    try {
      const [{ data: sessions }, { data: currentPlan }] = await Promise.all([
        supabase.from("sessions_cours").select("id,groupe_id").eq("groupe_id", groupId).order("started_at", { ascending: false }).limit(100),
        supabase.from("session_seating_snapshots").select("session_id,groupe_id,eleve_id,eleve_nom,position_x,position_y").eq("session_id", sessionId).order("eleve_id"),
      ])

      const sessionRows = (sessions || []) as Session[]
      const planRows = (currentPlan || []) as Snapshot[]
      if (planRows.length < 2) throw new Error("Le plan historique de cette séance n'est pas disponible.")

      const sessionIds = sessionRows.map((s) => s.id)
      const [{ data: logs }, { data: allPlans }] = await Promise.all([
        supabase.from("ecarts_conduite_log").select("session_id,eleve_id,eleve_nom,action_type,phase_cours,created_at").in("session_id", sessionIds).order("created_at", { ascending: true }).limit(5000),
        supabase.from("session_seating_snapshots").select("session_id,groupe_id,eleve_id,eleve_nom,position_x,position_y").in("session_id", sessionIds).limit(10000),
      ])

      const logRows = (logs || []) as Log[]
      const planHistory = (allPlans || []) as Snapshot[]
      const ids = Array.from(new Set(planRows.map((p) => p.eleve_id))).sort((a, b) => a - b)
      const idToKey = new Map<number, string>()
      const names: Record<string, string> = {}
      ids.forEach((id, index) => {
        const key = `student_${String(index + 1).padStart(3, "0")}`
        idToKey.set(id, key)
        names[key] = planRows.find((p) => p.eleve_id === id)?.eleve_nom || key
      })

      const negativeTypes = new Set(["manquement", "retenue", "retrait", "retrait_direct"])
      const students = planRows.map((seat) => {
        const relevant = logRows.filter((l) => l.eleve_id === seat.eleve_id)
        return {
          key: idToKey.get(seat.eleve_id)!,
          x: seat.position_x ?? 0,
          y: seat.position_y ?? 4,
          negative: relevant.filter((l) => negativeTypes.has(l.action_type)).length,
          bravos: relevant.filter((l) => l.action_type === "bravo").length,
        }
      })

      const events = logRows.map((log) => {
        const historicalSeat = planHistory.find((p) => p.session_id === log.session_id && p.eleve_id === log.eleve_id)
        return {
          session: log.session_id,
          student: idToKey.get(log.eleve_id) || `unknown_${log.eleve_id}`,
          action: log.action_type,
          phase: log.phase_cours,
          x: historicalSeat?.position_x ?? null,
          y: historicalSeat?.position_y ?? null,
          timestamp: log.created_at,
        }
      }).filter((e) => !e.student.startsWith("unknown_"))

      const response = await fetch("/api/ai/seating-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: { cols: 7, rows: 5 }, students, events, sessionCount: sessionRows.length }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Analyse IA impossible.")

      setBasePlan(planRows)
      setKeyToName(names)
      setResult(data as AIResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse IA impossible.")
    } finally {
      setLoading(false)
    }
  }

  const suggested = basePlan.map((seat) => {
    const key = Object.keys(keyToName).find((k) => keyToName[k] === seat.eleve_nom)
    const move = result?.moves.find((m) => m.student === key)
    return { ...seat, x: move?.x ?? seat.position_x ?? 0, y: move?.y ?? seat.position_y ?? 4, moved: !!move, reason: move?.reason || "" }
  })

  return (
    <section className="kl-suggestion kl-ai-suggestion">
      <div className="kl-suggestion-head">
        <div>
          <strong>Klimato AI · plan de classe</strong>
          <p>Analyse OpenAI pseudonymisée : aucun nom d’élève n’est transmis au modèle.</p>
        </div>
        <button onClick={analyze} disabled={loading}>{loading ? "Analyse en cours…" : result ? "Relancer l’analyse IA" : "Analyser avec l’IA"}</button>
      </div>

      {error && <p className="kl-ai-error">{error}</p>}

      {result && (
        <div className="kl-suggestion-body">
          <div className="kl-ai-summary">
            <div><span>Confiance</span><strong>{result.confidence}</strong></div>
            <p>{result.summary}</p>
          </div>

          {suggested.length > 0 && (
            <div className="kl-seatmap kl-suggested-map">
              {Array.from({ length: 35 }).map((_, i) => <div key={i} className="kl-seatcell" />)}
              {suggested.map((seat) => (
                <div key={seat.eleve_id} className={`kl-seat ${seat.moved ? "is-suggested-move" : ""}`} style={{ gridColumn: seat.x + 1, gridRow: seat.y + 1 }} title={seat.reason || undefined}>
                  {seat.eleve_nom}
                  {seat.moved && <span className="kl-move-tag">déplacé</span>}
                </div>
              ))}
            </div>
          )}

          {result.moves.length > 0 && <div className="kl-reasons">{result.moves.map((move) => <div key={move.student}><strong>{keyToName[move.student] || move.student}</strong><p>{move.reason}</p></div>)}</div>}

          {result.signals.length > 0 && <div className="kl-ai-signals"><h3>Signaux détectés</h3>{result.signals.map((signal, i) => <div key={i}><strong>{signal.title} <small>{signal.strength}</small></strong><p>{signal.explanation}</p></div>)}</div>}

          {result.limitations.length > 0 && <div className="kl-ai-limits"><strong>Limites de l’analyse</strong><ul>{result.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        </div>
      )}
    </section>
  )
}
