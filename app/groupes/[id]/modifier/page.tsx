"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "../../../../lib/supabase"

type Groupe = { id: number; numero: string | null; nom: string | null }
type Eleve = { id: number; nom: string; position_x: number | null; position_y: number | null }

export default function ModifierGroupePage() {
  const params = useParams()
  const router = useRouter()
  const groupeId = Number(params.id)
  const [groupe, setGroupe] = useState<Groupe | null>(null)
  const [eleves, setEleves] = useState<Eleve[]>([])
  const [nomGroupe, setNomGroupe] = useState("")
  const [nouvelEleve, setNouvelEleve] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)

  async function charger() {
    setLoading(true)
    const [{ data: g, error: gError }, { data: e, error: eError }] = await Promise.all([
      supabase.from("groupes").select("id, numero, nom").eq("id", groupeId).single(),
      supabase.from("eleves").select("id, nom, position_x, position_y").eq("groupe_id", groupeId).order("id"),
    ])
    if (gError || !g) { setMessage("Groupe introuvable ou inaccessible."); setLoading(false); return }
    if (eError) { setMessage("Impossible de charger les élèves."); setLoading(false); return }
    setGroupe(g as Groupe)
    setNomGroupe(g.numero || g.nom || "")
    setEleves((e || []) as Eleve[])
    setLoading(false)
  }

  useEffect(() => { if (Number.isFinite(groupeId)) charger() }, [groupeId])

  async function enregistrerNom() {
    const nom = nomGroupe.trim()
    if (!nom) return
    const { error } = await supabase.from("groupes").update({ numero: nom }).eq("id", groupeId)
    setMessage(error ? "Impossible de modifier le nom du groupe." : "Nom du groupe enregistré.")
    if (!error) await charger()
  }

  async function ajouterEleve() {
    const nom = nouvelEleve.trim()
    if (!nom) return
    const index = eleves.length
    const colonnes = Math.min(6, Math.max(4, Math.ceil(Math.sqrt(index + 1))))
    const { error } = await supabase.from("eleves").insert({
      nom,
      groupe_id: groupeId,
      niveau: 0,
      regle_manquement: 0,
      regle_retenue: 0,
      regle_retrait: 0,
      position_x: index % colonnes,
      position_y: Math.floor(index / colonnes),
    })
    if (error) { setMessage("Impossible d'ajouter cet élève."); return }
    setNouvelEleve("")
    setMessage(`${nom} ajouté au groupe.`)
    await charger()
  }

  async function renommerEleve(eleve: Eleve) {
    const nom = window.prompt("Nom de l'élève :", eleve.nom)?.trim()
    if (!nom || nom === eleve.nom) return
    const { error } = await supabase.from("eleves").update({ nom }).eq("id", eleve.id).eq("groupe_id", groupeId)
    if (error) { setMessage("Impossible de renommer cet élève."); return }
    await charger()
  }

  async function supprimerEleve(eleve: Eleve) {
    if (!window.confirm(`Retirer ${eleve.nom} de ce groupe ?\n\nSes données historiques déjà enregistrées restent dans l'historique des séances.`)) return
    const { error } = await supabase.from("eleves").delete().eq("id", eleve.id).eq("groupe_id", groupeId)
    if (error) { setMessage("Impossible de supprimer cet élève. Il peut avoir des données liées à une séance en cours."); return }
    setMessage(`${eleve.nom} retiré du groupe.`)
    await charger()
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 pt-20 text-slate-600">Chargement…</main>

  return (
    <main className="min-h-screen bg-slate-50 p-5 pt-20 md:p-10 md:pt-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Klimato</p><h1 className="text-3xl font-black">Modifier le groupe</h1><p className="mt-1 text-slate-500">{eleves.length} élève{eleves.length === 1 ? "" : "s"}</p></div>
          <button onClick={() => router.push(`/telecommande/${groupeId}`)} className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white">Ouvrir la télécommande →</button>
        </div>

        {message && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black">Nom du groupe</h2>
          <div className="mt-3 flex gap-2"><input value={nomGroupe} onChange={(e) => setNomGroupe(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3" /><button onClick={enregistrerNom} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Enregistrer</button></div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black">Élèves</h2>
          <p className="mt-1 text-sm text-slate-500">Ajoute, renomme ou retire des élèves sans recréer le groupe.</p>
          <div className="mt-4 flex gap-2"><input value={nouvelEleve} onChange={(e) => setNouvelEleve(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ajouterEleve() }} placeholder="Nom du nouvel élève" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3" /><button onClick={ajouterEleve} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">+ Ajouter</button></div>

          <div className="mt-5 divide-y divide-slate-100">
            {eleves.map((eleve) => <div key={eleve.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{eleve.nom}</span><div className="flex gap-2"><button onClick={() => renommerEleve(eleve)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold">✏️ Renommer</button><button onClick={() => supprimerEleve(eleve)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Retirer</button></div></div>)}
            {eleves.length === 0 && <div className="py-8 text-center text-slate-500">Aucun élève dans ce groupe.</div>}
          </div>
        </section>
      </div>
    </main>
  )
}
