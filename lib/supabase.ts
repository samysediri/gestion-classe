import { createClient } from "@supabase/supabase-js"

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://wtpljoegmjhinqeilupt.supabase.co"

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_2sJvk96T91kVBSBXkfqXqg_iiJforY5"

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
