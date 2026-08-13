import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Configuration Supabase manquante")
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Pont de compatibilité pour la bêta multi-enseignants.
// Le prototype de classe utilise encore le nom `config`.
// Sur cette branche, ces appels sont dirigés vers `teacher_config`.
const originalFrom = client.from.bind(client)
;(client as any).from = (relation: string) =>
  originalFrom(relation === "config" ? "teacher_config" : relation)

export const supabase = client
