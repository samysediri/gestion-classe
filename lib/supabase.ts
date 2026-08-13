import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key"

// Do not throw during Next.js prerendering. The real public credentials are
// injected by Vercel in Preview/Production and used by the browser bundle.
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
