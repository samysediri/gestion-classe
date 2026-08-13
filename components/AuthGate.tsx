"use client"

import { FormEvent, useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"

type Mode = "connexion" | "inscription"

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>("connexion")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage("")

    if (mode === "connexion") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setSubmitting(false)

      if (error) {
        setMessage("Impossible de se connecter. Vérifie ton courriel et ton mot de passe.")
      }
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      return
    }

    if (!data.session) {
      setMessage("Compte créé. Vérifie ton courriel pour confirmer ton inscription, puis connecte-toi.")
      setMode("connexion")
      return
    }

    setMessage("Compte créé.")
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="text-4xl font-black tracking-tight">Klimato</div>
          <div className="mt-3 text-sm text-slate-400">Chargement…</div>
        </div>
      </main>
    )
  }

  if (session) return <>{children}</>

  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white text-slate-950 p-7 shadow-2xl">
        <div className="mb-7">
          <div className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white font-black text-xl">K</span>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Klimato</h1>
              <p className="text-sm text-slate-500">Le climat de classe, visible en temps réel.</p>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 ${mode === "connexion" ? "bg-white shadow-sm" : "text-slate-500"}`}
            onClick={() => {
              setMode("connexion")
              setMessage("")
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 ${mode === "inscription" ? "bg-white shadow-sm" : "text-slate-500"}`}
            onClick={() => {
              setMode("inscription")
              setMessage("")
            }}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Courriel professionnel</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
              placeholder="prof@ecole.ca"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Mot de passe</span>
            <input
              type="password"
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
              placeholder="8 caractères minimum"
            />
          </label>

          {message && (
            <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white disabled:opacity-50"
          >
            {submitting
              ? "Un instant…"
              : mode === "connexion"
                ? "Se connecter"
                : "Créer mon espace Klimato"}
          </button>
        </form>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Klimato est destiné au personnel scolaire autorisé. Les données de classe seront isolées par compte enseignant.
        </p>
      </section>
    </main>
  )
}
