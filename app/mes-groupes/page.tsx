"use client"

import { useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../../lib/supabase"
import { useRouter } from "next/navigation"

type Groupe = { id: number; numero: string | null; nom: string | null; owner_id: string | null }

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
  const listeEleves = useMemo(() => elevesText.split("\n").map((n) => n.trim()).filter(Boolean), [elevesText])

  async function getCurrentUser() { const { data, error } = await supabase.auth.getUser(); if (error || !data.user) { setUser(null); setLoading(false); return null }; setUser(data.user); return data.user }
  async function chargerGroupes(ownerId?: string) { const currentUser = user ?? (await getCurrentUser()); const id = ownerId ?? currentUser?.id; if (!id) { setGroupes([]); setLoading(false); return }; const { data, error } = await supabase.from("groupes").select("id, numero, nom, owner_id").eq("owner_id", id).order("id"); if (error) { setMessage("Impossible de charger tes groupes pour le moment."); setLoading(false); return }; setGroupes((data as Groupe[]) || []); setLoading(false) }
  useEffect(() => { (async () => { const currentUser = await getCurrentUser(); if (currentUser) await chargerGroupes(currentUser.id) })() }, [])

  async function ajouterGroupe() {
    const currentUser = user ?? (await getCurrentUser()); if (!currentUser) { setMessage("Ta session a expiré. Reconnecte-toi."); return }
    const numeroNettoye = numero.trim(); if (!numeroNettoye) { setMessage("Entre un numéro ou un nom de groupe."); return }
    setSaving(true); setMessage("")
    const { data: groupe, error } = await supabase.from("groupes").insert({ numero: numeroNettoye, owner_id: currentUser.id }).select("id, numero, nom, owner_id").single()
    if (error || !groupe) { setMessage("Erreur pendant la création du groupe."); setSaving(false); return }
    if (listeEleves.length > 0) { const colonnes = Math.min(6, Math.max(4, Math.ceil(Math.sqrt(listeEleves.length)))); const rows = listeEleves.map((nom, index) => ({ nom, groupe_id: groupe.id, niveau: 0, regle_manquement: 0, regle_retenue: 0, regle_retrait: 0, position_x: index % colonnes, position_y: Math.floor(index / colonnes) })); const { error: e } = await supabase.from("eleves").insert(rows); if (e) { setMessage("Le groupe a été créé, mais certains élèves n'ont pas pu être ajoutés."); setSaving(false); await chargerGroupes(currentUser.id); return } }
    setNumero(""); setElevesText(""); setShowForm(false); setSaving(false); router.push(`/telecommande/${groupe.id}`)
  }

  async function supprimerGroupe(g: Groupe) {
    const label = g.numero || g.nom || `#${g.id}`
    if (!window.confirm(`Supprimer définitivement le groupe ${label} ?\n\nSes élèves, séances, interventions et données de toilettes seront aussi supprimés. Cette action est irréversible.`)) return
    setMessage("Suppression du groupe en cours…")
    const { error: t } = await supabase.from("toilettes").delete().eq("groupe_id", g.id); if (t) { setMessage("La suppression a échoué au niveau des toilettes."); return }
    const { error: s } = await supabase.from("sessions_cours").delete().eq("groupe_id", g.id); if (s) { setMessage("La suppression a échoué au niveau de l'historique."); return }
    const { error: e } = await supabase.from("eleves").delete().eq("groupe_id", g.id); if (e) { setMessage("La suppression a échoué au niveau des élèves."); return }
    const { error: gr } = await supabase.from("groupes").delete().eq("id", g.id); if (gr) { setMessage("Impossible de supprimer le groupe."); return }
    setMessage(`Groupe ${label} supprimé.`); await chargerGroupes()
  }

  async function seDeconnecter() { await supabase.auth.signOut(); router.push("/") }

  return <main className="min-h-screen bg-slate-50 p-5 md:p-10"><div className="mx-auto max-w-6xl">
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Klimato</p><h1 className="text-3xl font-black">Mes groupes</h1>{user?.email && <p className="mt-1 text-sm text-slate-500">{user.email}</p>}</div><div className="flex flex-wrap gap-2"><button onClick={() => router.push("/historique")} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold">📊 Historique</button><button onClick={() => window.open("/ecran", "_blank", "noopener,noreferrer")} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold">📺 Écran TV</button><button onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">{showForm ? "Fermer" : "+ Ajouter un groupe"}</button><button onClick={seDeconnecter} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold">Déconnexion</button></div></header>
    <div className="mb-8 grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="font-black">1. Ouvre un groupe</div><p className="mt-1 text-sm text-slate-500">Le plan devient ta télécommande.</p></div><button onClick={() => window.open("/ecran", "_blank", "noopener,noreferrer")} className="rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200"><div className="font-black">2. Affiche Klimato sur la TV ↗</div><p className="mt-1 text-sm text-slate-500">Affichage destiné aux élèves.</p></button><button onClick={() => router.push("/historique")} className="rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200"><div className="font-black">3. Consulte les données →</div><p className="mt-1 text-sm text-slate-500">Séances et interventions.</p></button></div>
    {message && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}
    {showForm && <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-black">Prépare ton plan de classe</h2><p className="text-sm text-slate-500">Colle ta liste de classe.</p></div><div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{listeEleves.length} élève{listeEleves.length === 1 ? "" : "s"}</div></div><input placeholder="Nom ou numéro du groupe" value={numero} onChange={(e) => setNumero(e.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 p-3"/><textarea placeholder={`Alex\nSarah\nMathis\n...`} value={elevesText} onChange={(e) => setElevesText(e.target.value)} className="mt-3 h-52 w-full rounded-xl border border-slate-300 p-3"/><div className="mt-4 flex gap-3"><button onClick={ajouterGroupe} disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">{saving ? "Préparation…" : "Créer et ouvrir →"}</button><button onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-5 py-3 font-semibold">Annuler</button></div></section>}
    {loading ? <div className="rounded-3xl bg-white p-8">Chargement…</div> : groupes.length === 0 ? <section className="rounded-3xl border border-dashed bg-white p-10 text-center"><h2 className="text-2xl font-black">Ton espace Klimato est prêt.</h2><button onClick={() => setShowForm(true)} className="mt-6 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white">Créer mon premier groupe →</button></section> : <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groupes.map((g) => <article key={g.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><button className="w-full text-left" onClick={() => router.push(`/telecommande/${g.id}`)}><div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Groupe</div><div className="mt-2 text-3xl font-black">{g.numero || g.nom || `#${g.id}`}</div><div className="mt-5 text-sm font-semibold text-slate-500">Ouvrir la télécommande →</div></button><div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button onClick={() => router.push(`/groupes/${g.id}/modifier`)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold">✏️ Modifier groupe et élèves</button><button onClick={() => supprimerGroupe(g)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">🗑 Supprimer</button></div></article>)}</section>}
  </div></main>
}
