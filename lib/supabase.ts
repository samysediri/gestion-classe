import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://wtpljoegmjhinqeilupt.supabase.co"
const supabaseKey = "sb_publishable_2sJvk96T91kVBSBXkfqXqg_iiJforY5"

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
