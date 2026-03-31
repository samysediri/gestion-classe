import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://wtpljoegmjhinqeilupt.supabase.co"
const supabaseKey = "sb_publishable_2sJvk96T91kVBSBXkfqXqg_iiJforY5"

export const supabase = createClient(supabaseUrl, supabaseKey)
