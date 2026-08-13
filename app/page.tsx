import { redirect } from "next/navigation"

// Fresh preview build: use current Vercel environment variables.
export default function Page() {
  redirect("/mes-groupes")
}
