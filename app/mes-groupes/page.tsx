"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../../lib/supabase"
import { useRouter } from "next/navigation"

type Groupe = {
  id: number
  numero: string | null
  nom: string | null
  owner_id: string | null
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [groupes, setGroupes] = useState<Groupe[]>([])
  const [showForm, setShowForm] = useState(false)
  const [numero, setNumero] = useState("")
  const [elevesText, setElevesText] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const router = useRouter()

  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      setUser(null)
      setLoading(false)
      return null
    }

    setUser(data.user)
    return data.user
  }

  async function chargerGroupes(ownerId?: string) {
    const currentUser = user ?? (await getCurrentUser())
    const id = ownerId ?? currentUser?.id

    if (!id) {
      setGroupes([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("groupes")
      .select("id, numero, nom, owner_id")
      .eq("owner_id", id)
      .order("id")

    if (error) {
      console.error("ERREUR LOAD GROUPES:", error)
      setMessage("Impossible de charger tes groupes pour le moment.")
      setLoading(false)
      return
    }

    setGroupes((data as Groupe[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const currentUser = await getCurrentUser()
      if (currentUser) await chargerGroupes(currentUser.id)
    }

    init()
  }, [])

  async function ajouterGroupe() {
    const currentUser = user ?? (await getCurrentUser())

    if (!currentUser) {
      setMessage("Ta session a expiré. Reconnecte-toi.")
      return
    }

    const numeroNettoye = numero.trim()
    if (!numeroNettoye) {
      setMessage("Entre un numéro ou un nom de groupe.")
      return
    }

    setSaving(true)
    setMessage("")

    const { data: groupe, error } = await supabase
      .from("groupes")
      .insert({
        numero: numeroNettoye,
        owner_id: currentUser.id,
      })
      .select("id, numero, nom, owner_id")
      .single()

    if (error || !groupe) {
      console.error("ERREUR INSERT GROUPE:", error)
      setMessage("Erreur pendant la création du groupe.")
      setSaving(false)
      return
    }

    const liste = elevesText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0)

    if (liste.length > 0) {
      const elevesToInsert = liste.map((nom) => ({
        nom,
        groupe_id: groupe.id,
        niveau: 0,
        regle_manquement: 0,
        regle_retenue: 0,
        regle_retrait: 0,
        position_x: 0,
        position_y: 0,
      }))

      const { error: errEleves } = await supabase
        .from("eleves")
        .insert(elevesToInsert)

      if (errEleves) {
        console.error("ERREUR ELEVE:", errEleves)
        setMessage("Le groupe a été créé, mais certains élèves n'ont pas pu être ajoutés.")
      }
    }

    setNumero("")
    setElevesText("")
    setShowForm(false)
    setSaving(false)
    await chargerGroupes(currentUser.id)
  }

  async function seDeconnecter() {
    await supabase.auth.signOut()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Klimato</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Mes groupes</h1>
            {user?.email && <p className="mt-1 text-sm text-slate-500">{user.email}</p>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((value) => !value)}
              className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"
            >
              {showForm ? "Fermer" : "+ Ajouter un groupe"}
            </button>
            <button
              onClick={seDeconnecter}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700"
            >
              Déconnexion
            </button>
          </div>
        </header>

        {message && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {message}
          </div>
        )}

        {showForm && (
          <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Nouveau groupe</h2>
            <p className="mt-1 text-sm text-slate-500">Crée ton groupe et colle simplement les prénoms, un par ligne.</p>

            <input
              placeholder="Numéro ou nom du groupe (ex. 305)"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="mt-5 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-950"
            />

            <textarea
              placeholder={`Élèves (un par ligne)\nAlex\nSarah\nMathis`}
              value={elevesText}
              onChange={(e) => setElevesText(e.target.value)}
              className="mt-4 h-44 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-950"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={ajouterGroupe}
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving ? "Création…" : "Créer le groupe"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700"
              >
                Annuler
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">Chargement des groupes…</div>
        ) : groupes.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-5xl">🌤️</div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">Ton espace Klimato est prêt.</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-500">Ajoute ton premier groupe pour commencer. Les groupes de chaque enseignant restent séparés dans Klimato.</p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupes.map((g) => (
              <button
                key={g.id}
                className="rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => router.push(`/telecommande/${g.id}`)}
              >
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Groupe</div>
                <div className="mt-2 text-3xl font-black text-slate-950">{g.numero || g.nom || `#${g.id}`}</div>
                <div className="mt-5 text-sm font-semibold text-slate-500">Ouvrir la télécommande →</div>
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
