"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ecran(){

  const [eleves,setEleves] = useState<any[]>([])

  async function charger(){

    const {data:config} = await supabase
      .from("config")
      .select("*")
      .eq("id",1)
      .single()

    if(!config || !config.groupe_actif){
      setEleves([])
      return
    }

    const {data} = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id",config.groupe_actif)

    setEleves(data || [])
  }

  useEffect(()=>{
    const interval = setInterval(charger,500)
    return ()=> clearInterval(interval)
  },[])

  const manquement = eleves.filter(e => e.niveau >= 1)
  const retenue = eleves.filter(e => e.niveau >= 2)
  const retrait = eleves.filter(e => e.niveau >= 3)

  return(

    <div className="w-screen h-screen flex">

      <div className="flex-1 bg-yellow-300 text-center">
        <h1 className="text-4xl">Manquement</h1>
        {manquement.map(e => <div key={e.id}>{e.nom}</div>)}
      </div>

      <div className="flex-1 bg-orange-300 text-center">
        <h1 className="text-4xl">Retenue</h1>
        {retenue.map(e => <div key={e.id}>{e.nom}</div>)}
      </div>

      <div className="flex-1 bg-red-300 text-center">
        <h1 className="text-4xl">Retrait</h1>
        {retrait.map(e => <div key={e.id}>{e.nom}</div>)}
      </div>

    </div>

  )
}
