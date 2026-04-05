"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

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
  regle: number | null
  niveau_avant: number | null
  niveau_apres: number | null
  phase_cours: string | null
  created_at: string
}

type SessionRow = {
  id: number
  groupe_id: number
  date_cours: string
  started_at: string
  ended_at: string | null
  phase_depart: string | null
  phase_fin: string | null
  actif: boolean
}

export default function HistoriquePage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  const [filtreGroupe, setFiltreGroupe] = useState("")
  const [filtreEleve, setFiltreEleve] = useState("")
  const [filtreAction, setFiltreAction] = useState("")
  const [filtreDate, setFiltreDate] = useState("")

  async function charger() {
    setLoading(true)

    const [
      { data: logsData, error: logsError },
      { data: sessionsData, error: sessionsError },
    ] = await Promise.all([
      supabase
        .from("ecarts_conduite_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),

      supabase
        .from("sessions_cours")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(300),
    ])

    if (logsError) {
      console.error("ERREUR LOGS:", logsError)
      setLogs([])
    } else {
      setLogs((logsData ?? []) as LogRow[])
    }

    if (sessionsError) {
      console.error("ERREUR SESSIONS:", sessionsError)
      setSessions([])
    } else {
      setSessions((sessionsData ?? []) as SessionRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    charger()
  }, [])

  function formatDateTime(value: string) {
    const d = new Date(value)
    return d.toLocaleString("fr-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  function formatDateOnly(value: string) {
    const d = new Date(value)
    return d.toLocaleDateString("fr-CA")
  }

  function phaseLabel(phase: string | null) {
    if (phase === "pratique_guidee") return "Pratique guidée"
    if (phase === "pratique_autonome") return "Pratique autonome"
    if (phase === "modelage") return "Modelage"
    return "—"
  }

  function actionLabel(action: LogRow["action_type"]) {
    if (action === "manquement") return "Manquement"
    if (action === "retenue") return "Retenue"
    if (action === "retrait") return "Retrait"
    if (action === "retrait_direct") return "Retrait direct"
    if (action === "toilettes_depart") return "Toilettes départ"
    if (action === "toilettes_retour") return "Toilettes retour"
    return action
  }

  function actionBadgeClass(action: LogRow["action_type"]) {
    if (action === "manquement") return "bg-yellow-100 text-yellow-800 border-yellow-300"
    if (action === "retenue") return "bg-orange-100 text-orange-800 border-orange-300"
    if (action === "retrait") return "bg-red-100 text-red-800 border-red-300"
    if (action === "retrait_direct") return "bg-red-200 text-red-900 border-red-400"
    if (action === "toilettes_depart") return "bg-sky-100 text-sky-800 border-sky-300"
    if (action === "toilettes_retour") return "bg-emerald-100 text-emerald-800 border-emerald-300"
    return "bg-gray-100 text-gray-800 border-gray-300"
  }

  const groupesDisponibles = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.groupe_id))).sort((a, b) => a - b)
  }, [logs])

  const actionsDisponibles = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action_type)))
  }, [logs])

  const logsFiltres = useMemo(() => {
    return logs.filter((log) => {
      const matchGroupe = !filtreGroupe || String(log.groupe_id) === filtreGroupe
      const matchEleve =
        !filtreEleve ||
        log.eleve_nom.toLowerCase().includes(filtreEleve.trim().toLowerCase())
      const matchAction = !filtreAction || log.action_type === filtreAction
      const matchDate =
        !filtreDate || formatDateOnly(log.created_at) === filtreDate

      return matchGroupe && matchEleve && matchAction && matchDate
    })
  }, [logs, filtreGroupe, filtreEleve, filtreAction, filtreDate])

  const sessionsFiltrees = useMemo(() => {
    return sessions.filter((s) => {
      const matchGroupe = !filtreGroupe || String(s.groupe_id) === filtreGroupe
      const matchDate = !filtreDate || formatDateOnly(s.started_at) === filtreDate
      return matchGroupe && matchDate
    })
  }, [sessions, filtreGroupe, filtreDate])

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Historique de gestion de classe</h1>
            <p className="mt-1 text-sm text-gray-600">
              Consulte les séances et tous les écarts de conduite enregistrés.
            </p>
          </div>

          <button
            onClick={charger}
            className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Actualiser
          </button>
        </div>

        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-gray-500">Filtres</div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                Groupe
              </label>
              <select
                value={filtreGroupe}
                onChange={(e) => setFiltreGroupe(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Tous les groupes</option>
                {groupesDisponibles.map((g) => (
                  <option key={g} value={String(g)}>
                    Groupe {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                Élève
              </label>
              <input
                value={filtreEleve}
                onChange={(e) => setFiltreEleve(e.target.value)}
                placeholder="Nom de l’élève"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                Type d’action
              </label>
              <select
                value={filtreAction}
                onChange={(e) => setFiltreAction(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Toutes les actions</option>
                {actionsDisponibles.map((action) => (
                  <option key={action} value={action}>
                    {actionLabel(action)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">
                Date
              </label>
              <input
                type="date"
                value={filtreDate}
                onChange={(e) => setFiltreDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-500">Événements filtrés</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{logsFiltres.length}</div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-500">Séances filtrées</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{sessionsFiltrees.length}</div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-500">Dernière actualisation</div>
            <div className="mt-2 text-lg font-bold text-gray-900">
              {new Date().toLocaleTimeString("fr-CA")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.9fr]">
          <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-bold text-gray-900">Séances</h2>
            </div>

            <div className="max-h-[75vh] overflow-auto p-3">
              {loading ? (
                <div className="p-4 text-sm text-gray-500">Chargement...</div>
              ) : sessionsFiltrees.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Aucune séance trouvée.</div>
              ) : (
                <div className="space-y-3">
                  {sessionsFiltrees.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-base font-bold text-gray-900">
                          Groupe {session.groupe_id}
                        </div>
                        <div
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            session.actif
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {session.actif ? "Active" : "Terminée"}
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-gray-700">
                        <div>
                          <span className="font-semibold">Date :</span>{" "}
                          {formatDateOnly(session.started_at)}
                        </div>
                        <div>
                          <span className="font-semibold">Début :</span>{" "}
                          {formatDateTime(session.started_at)}
                        </div>
                        <div>
                          <span className="font-semibold">Fin :</span>{" "}
                          {session.ended_at ? formatDateTime(session.ended_at) : "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Phase départ :</span>{" "}
                          {phaseLabel(session.phase_depart)}
                        </div>
                        <div>
                          <span className="font-semibold">Phase fin :</span>{" "}
                          {phaseLabel(session.phase_fin)}
                        </div>
                        <div>
                          <span className="font-semibold">Session ID :</span> {session.id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-bold text-gray-900">Événements enregistrés</h2>
            </div>

            <div className="max-h-[75vh] overflow-auto">
              {loading ? (
                <div className="p-4 text-sm text-gray-500">Chargement...</div>
              ) : logsFiltres.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Aucun événement trouvé.</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {logsFiltres.map((log) => (
                    <div key={log.id} className="p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {log.eleve_nom}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          Groupe {log.groupe_id}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${actionBadgeClass(
                            log.action_type
                          )}`}
                        >
                          {actionLabel(log.action_type)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <span className="font-semibold">Date/heure :</span>{" "}
                          {formatDateTime(log.created_at)}
                        </div>

                        <div>
                          <span className="font-semibold">Phase :</span>{" "}
                          {phaseLabel(log.phase_cours)}
                        </div>

                        <div>
                          <span className="font-semibold">Règle :</span>{" "}
                          {log.regle ?? "—"}
                        </div>

                        <div>
                          <span className="font-semibold">Niveau avant :</span>{" "}
                          {log.niveau_avant ?? "—"}
                        </div>

                        <div>
                          <span className="font-semibold">Niveau après :</span>{" "}
                          {log.niveau_apres ?? "—"}
                        </div>

                        <div>
                          <span className="font-semibold">Session ID :</span>{" "}
                          {log.session_id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
