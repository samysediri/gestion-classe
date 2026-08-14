"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import AISeatingSuggestion from "../../components/AISeatingSuggestion"

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

type LogRow = {
  id: number
  session_id: number
  groupe_id: number
  eleve_id: number
  eleve_nom: string
  action_type: ActionType
  regle: number | null
  niveau_avant: number | null
  niveau_apres: number | null
  phase_cours: string | null
  created_at: string
}

type SessionRow = {
  id: number
  groupe_id: number
  started_at: string
  ended_at: string | null
  phase_depart: string | null
  phase_fin: string | null
  actif: boolean
}

type GroupeRow = { id: number; nom: string | null; numero: string | null }
type PlanRow = {
  id: number
  session_id: number
  groupe_id: number
  eleve_id: number
  eleve_nom: string
  position_x: number | null
  position_y: number | null
  niveau_initial: number | null
}

const negativeActions = new Set<ActionType>(["manquement", "retenue", "retrait", "retrait_direct"])

export default function HistoriquePage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [groupes, setGroupes] = useState<GroupeRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreGroupe, setFiltreGroupe] = useState("")
  const [periode, setPeriode] = useState("30")
  const [dateDebut, setDateDebut] = useState("")
  const [dateFin, setDateFin] = useState("")
  const [selectedSession, setSelectedSession] = useState<number | null>(null)
  const [step, setStep] = useState(0)

  async function charger() {
    setLoading(true)
    const [{ data: l }, { data: s }, { data: g }, { data: p }] = await Promise.all([
      supabase.from("ecarts_conduite_log").select("*").order("created_at", { ascending: false }).limit(5000),
      supabase.from("sessions_cours").select("*").order("started_at", { ascending: false }).limit(1000),
      supabase.from("groupes").select("id,nom,numero").order("id"),
      supabase.from("session_seating_snapshots").select("*").limit(10000),
    ])
    setLogs((l || []) as LogRow[])
    setSessions((s || []) as SessionRow[])
    setGroupes((g || []) as GroupeRow[])
    setPlans((p || []) as PlanRow[])
    setLoading(false)
  }

  useEffect(() => { charger() }, [])

  function groupName(id: number) {
    const g = groupes.find((x) => x.id === id)
    return g?.numero || g?.nom || `Groupe ${id}`
  }

  const cutoff = useMemo(() => {
    if (periode === "all" || dateDebut || dateFin) return null
    const d = new Date()
    d.setDate(d.getDate() - Number(periode))
    return d
  }, [periode, dateDebut, dateFin])

  const groupeIds = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.groupe_id))).sort((a, b) => groupName(a).localeCompare(groupName(b), "fr", { numeric: true })),
    [sessions, groupes]
  )

  const sessionsFiltrees = useMemo(() => sessions.filter((s) => {
    const d = new Date(s.started_at)
    return (!filtreGroupe || String(s.groupe_id) === filtreGroupe)
      && (!cutoff || d >= cutoff)
      && (!dateDebut || d >= new Date(`${dateDebut}T00:00:00`))
      && (!dateFin || d <= new Date(`${dateFin}T23:59:59.999`))
  }), [sessions, filtreGroupe, cutoff, dateDebut, dateFin])

  const sessionIds = useMemo(() => new Set(sessionsFiltrees.map((s) => s.id)), [sessionsFiltrees])
  const logsFiltres = useMemo(() => logs.filter((l) => sessionIds.has(l.session_id)), [logs, sessionIds])
  const positifs = logsFiltres.filter((l) => l.action_type === "bravo").length
  const negatifs = logsFiltres.filter((l) => negativeActions.has(l.action_type)).length
  const ratioPeriode = positifs + negatifs ? Math.round((positifs / (positifs + negatifs)) * 100) : null

  const activeSession = selectedSession
    ? sessionsFiltrees.find((s) => s.id === selectedSession)
    : sessionsFiltrees[0]

  const events = activeSession
    ? logs.filter((l) => l.session_id === activeSession.id).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    : []

  const activePositifs = events.filter((l) => l.action_type === "bravo").length
  const activeNegatifs = events.filter((l) => negativeActions.has(l.action_type)).length
  const ratioSession = activePositifs + activeNegatifs ? Math.round((activePositifs / (activePositifs + activeNegatifs)) * 100) : null
  const plan = activeSession ? plans.filter((p) => p.session_id === activeSession.id) : []

  useEffect(() => { setStep(0) }, [activeSession?.id])

  const currentEvent = step > 0 ? events[step - 1] : null
  const replay = useMemo(() => plan.map((seat) => {
    let niveau = seat.niveau_initial ?? 0
    let bravos = 0
    for (const event of events.slice(0, step)) {
      if (event.eleve_id !== seat.eleve_id) continue
      if (event.action_type === "bravo") bravos += 1
      if (event.niveau_apres != null) niveau = event.niveau_apres
    }
    return {
      ...seat,
      niveau,
      bravos,
      currentBravo: currentEvent?.action_type === "bravo" && currentEvent.eleve_id === seat.eleve_id,
    }
  }), [plan, events, step, currentEvent?.id])

  function time(value: string) {
    return new Date(value).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
  }

  function date(value: string) {
    return new Date(value).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" })
  }

  function durationMinutes(s: SessionRow) {
    if (!s.ended_at) return null
    return Math.max(1, Math.round((+new Date(s.ended_at) - +new Date(s.started_at)) / 60000))
  }

  function duration(s: SessionRow) {
    const minutes = durationMinutes(s)
    return minutes == null ? "En cours" : `${minutes} min`
  }

  function phase(value: string | null) {
    if (value === "pratique_guidee") return "Pratique guidée"
    if (value === "pratique_autonome") return "Pratique autonome"
    if (value === "modelage") return "Modelage"
    return "—"
  }

  function actionLabel(action: ActionType) {
    return ({
      bravo: "Bravo",
      manquement: "Manquement",
      retenue: "Retenue",
      retrait: "Retrait",
      retrait_direct: "Retrait direct",
      toilettes_depart: "Sortie toilettes",
      toilettes_retour: "Retour toilettes",
      manquement_retire: "Manquement annulé",
      retenue_retiree: "Retenue annulée",
    } as Record<ActionType, string>)[action]
  }

  function sessionStats(id: number) {
    const rows = logs.filter((l) => l.session_id === id)
    const p = rows.filter((l) => l.action_type === "bravo").length
    const n = rows.filter((l) => negativeActions.has(l.action_type)).length
    return { p, n, ratio: p + n ? Math.round((p / (p + n)) * 100) : null }
  }

  function levelColor(level: number) {
    if (level === 0) return "#3b82f6"
    if (level === 1) return "#facc15"
    if (level === 2) return "#f97316"
    return "#dc2626"
  }

  function csvEscape(value: unknown) {
    const s = value == null ? "" : String(value)
    return `"${s.replaceAll('"', '""')}"`
  }

  function exportCSV() {
    const rows = logsFiltres
      .slice()
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
      .map((log) => {
        const s = sessions.find((x) => x.id === log.session_id)
        const seat = plans.find((x) => x.session_id === log.session_id && x.eleve_id === log.eleve_id)
        return [
          log.session_id, groupName(log.groupe_id), log.groupe_id, log.eleve_id, log.eleve_nom,
          actionLabel(log.action_type), log.action_type, log.regle ?? "", log.niveau_avant ?? "", log.niveau_apres ?? "",
          phase(log.phase_cours), log.created_at, s?.started_at ?? "", s?.ended_at ?? "", s ? durationMinutes(s) ?? "" : "",
          s ? phase(s.phase_depart) : "", s ? phase(s.phase_fin) : "", seat?.position_x ?? "", seat?.position_y ?? "",
        ]
      })
    const head = [
      "session_id", "groupe", "groupe_id_interne", "eleve_id", "eleve_nom", "action", "action_code", "regle",
      "niveau_avant", "niveau_apres", "phase_evenement", "horodatage_evenement", "debut_seance", "fin_seance",
      "duree_minutes", "phase_depart", "phase_fin", "position_x_debut", "position_y_debut",
    ]
    const csv = "\uFEFF" + [head, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `klimato-historique-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="kl-page">
      <div className="kl-shell">
        <header className="kl-header">
          <div>
            <span className="kl-brand">KLIMATO</span>
            <h1>Historique</h1>
            <p>Ce qui s’est passé dans tes cours, séance par séance.</p>
          </div>
          <div className="flex gap-4">
            <button className="kl-text-button" onClick={exportCSV}>Exporter CSV</button>
            <button className="kl-text-button" onClick={charger}>Actualiser</button>
          </div>
        </header>

        <div className="kl-toolbar">
          <label>Groupe
            <select value={filtreGroupe} onChange={(e) => { setFiltreGroupe(e.target.value); setSelectedSession(null) }}>
              <option value="">Tous</option>
              {groupeIds.map((id) => <option key={id} value={id}>{groupName(id)}</option>)}
            </select>
          </label>
          <label>Période
            <select value={periode} onChange={(e) => { setPeriode(e.target.value); setDateDebut(""); setDateFin(""); setSelectedSession(null) }}>
              <option value="7">7 jours</option><option value="30">30 jours</option><option value="90">3 mois</option><option value="all">Tout</option>
            </select>
          </label>
          <label>Du<input type="date" value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); setSelectedSession(null) }} /></label>
          <label>Au<input type="date" value={dateFin} onChange={(e) => { setDateFin(e.target.value); setSelectedSession(null) }} /></label>
        </div>

        <section className="kl-summary">
          <div className="kl-climate"><span>Climat positif · période</span><strong>{ratioPeriode == null ? "—" : `${ratioPeriode}%`}</strong><em>{positifs} bravos · {negatifs} interventions</em></div>
          <div className="kl-climate"><span>Climat · séance sélectionnée</span><strong>{ratioSession == null ? "—" : `${ratioSession}%`}</strong><em>{activeSession ? `${activePositifs} bravos · ${activeNegatifs} interventions` : "Aucune séance"}</em></div>
          <div><span>Séances</span><strong>{sessionsFiltrees.length}</strong></div>
          <div><span>Événements</span><strong>{logsFiltres.length}</strong></div>
        </section>

        {loading ? <p className="kl-empty">Chargement…</p> : sessionsFiltrees.length === 0 ? <p className="kl-empty">Aucune séance pour cette période.</p> : (
          <div className="kl-history-grid">
            <section className="kl-session-list">
              <h2>Séances</h2>
              {sessionsFiltrees.map((s) => {
                const st = sessionStats(s.id)
                return <button key={s.id} onClick={() => setSelectedSession(s.id)} className={`kl-session ${activeSession?.id === s.id ? "is-active" : ""}`}>
                  <div className="kl-session-top"><strong>{groupName(s.groupe_id)}</strong><span>{date(s.started_at)}</span></div>
                  <div className="kl-session-time">{time(s.started_at)}{s.ended_at ? `–${time(s.ended_at)}` : ""} · {duration(s)}</div>
                  <div className="kl-session-stats"><span>{st.ratio == null ? "Aucune intervention" : `${st.ratio}% positif`}</span><span>{st.p} bravo · {st.n} intervention{st.n === 1 ? "" : "s"}</span></div>
                </button>
              })}
            </section>

            {activeSession && <section className="kl-detail">
              <div className="kl-detail-head">
                <div><span className="kl-kicker">{date(activeSession.started_at)}</span><h2>{groupName(activeSession.groupe_id)}</h2><p>{time(activeSession.started_at)}{activeSession.ended_at ? `–${time(activeSession.ended_at)}` : ""} · {duration(activeSession)} · {ratioSession == null ? "aucune intervention" : `${ratioSession}% positif`}</p></div>
                <div className="kl-phase">{phase(activeSession.phase_depart)} → {phase(activeSession.phase_fin)}</div>
              </div>

              {plan.length > 0 ? <>
                <section className="kl-replay">
                  <div className="kl-replay-head">
                    <div><strong>Évolution du plan de classe</strong><span>{step === 0 ? "Début du cours" : `${time(events[step - 1].created_at)} · ${events[step - 1].eleve_nom} · ${actionLabel(events[step - 1].action_type)}`}</span></div>
                    <div><button disabled={step === 0} onClick={() => setStep((x) => Math.max(0, x - 1))}>←</button><b>{step} / {events.length}</b><button disabled={step === events.length} onClick={() => setStep((x) => Math.min(events.length, x + 1))}>→</button></div>
                  </div>
                  <div className="kl-seatmap">
                    {Array.from({ length: 35 }).map((_, i) => <div key={i} className="kl-seatcell" />)}
                    {replay.map((e) => <div key={e.eleve_id} className={`kl-seat ${e.currentBravo ? "has-current-bravo" : ""}`} style={{ gridColumn: (e.position_x ?? 0) + 1, gridRow: (e.position_y ?? 4) + 1, background: levelColor(e.niveau), color: e.niveau >= 3 ? "white" : "#111" }}>
                      <span className="kl-seat-name">{e.eleve_nom}</span>{e.bravos > 0 && <span className="kl-bravo-count">+{e.bravos}</span>}{e.currentBravo && <span className="kl-bravo-now">+ Bravo</span>}
                    </div>)}
                  </div>
                  <div className="kl-legend"><span><i style={{ background: levelColor(0) }} />OK</span><span><i style={{ background: levelColor(1) }} />Manquement</span><span><i style={{ background: levelColor(2) }} />Retenue</span><span><i style={{ background: levelColor(3) }} />Retrait</span><span className="kl-bravo-legend"><i />Bravo</span></div>
                </section>

                <AISeatingSuggestion groupId={activeSession.groupe_id} sessionId={activeSession.id} />
              </> : <p className="kl-plan-note">Plan historique non disponible pour cette ancienne séance. Les nouvelles séances sont enregistrées automatiquement.</p>}

              <div className="kl-timeline">
                <div className="kl-event is-neutral"><time>{time(activeSession.started_at)}</time><i>·</i><div><strong>Début du cours</strong><small>{phase(activeSession.phase_depart)}</small></div></div>
                {events.map((event, i) => <div key={event.id} onClick={() => setStep(i + 1)} className={`kl-event ${event.action_type === "bravo" ? "is-positive" : negativeActions.has(event.action_type) ? "is-negative" : "is-neutral"}`}>
                  <time>{time(event.created_at)}</time><i>{event.action_type === "bravo" ? "+" : negativeActions.has(event.action_type) ? "−" : "·"}</i><div><strong>{event.eleve_nom}</strong><span>{actionLabel(event.action_type)}{event.regle ? ` · règle ${event.regle}` : ""}</span>{event.phase_cours && <small>{phase(event.phase_cours)}</small>}</div>
                </div>)}
                {activeSession.ended_at && <div className="kl-event is-neutral"><time>{time(activeSession.ended_at)}</time><i>·</i><div><strong>Fin du cours</strong><small>{phase(activeSession.phase_fin)}</small></div></div>}
              </div>
            </section>}
          </div>
        )}
      </div>
    </main>
  )
}
