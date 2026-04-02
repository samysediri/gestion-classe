"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ecran(){

  const [eleves,setEleves] = useState<any[]>([])

  async function chargerEleves(){
    const {data} = await supabase
      .from("eleves")
      .select("*")

    setEleves(data || [])
  }

  useEffect(()=>{
    chargerEleves()
    const interval = setInterval(chargerEleves,1000)
    return ()=> clearInterval(interval)
  },[])

  const manquement = eleves.filter(e => e.niveau >= 1)
  const retenue = eleves.filter(e => e.niveau >= 2)
  const retrait = eleves.filter(e => e.niveau >= 3)

  return(

    <div className="w-screen h-screen flex flex-col">

      {/* titre */}
      <div className="text-center text-4xl font-bold py-6">
        Gestion de classe
      </div>

      {/* colonnes */}
      <div className="flex flex-1 text-center">

        {/* MANQUEMENT */}
        <div className="flex-1 bg-yellow-300 p-6">
          <h2 className="text-3xl font-bold mb-6">Manquement</h2>

          {manquement.map(e=>(
            <div key={e.id} className="text-3xl mb-2">
              {e.nom} #{e.regle_manquement}
            </div>
          ))}
        </div>

        {/* RETENUE */}
        <div className="flex-1 bg-orange-300 p-6">
          <h2 className="text-3xl font-bold mb-6">Retenue</h2>

          {retenue.map(e=>(
            <div key={e.id} className="text-3xl mb-2">
              {e.nom} #{e.regle_retenue}
            </div>
          ))}
        </div>

        {/* RETRAIT */}
        <div className="flex-1 bg-red-300 p-6">
          <h2 className="text-3xl font-bold mb-6">Retrait</h2>

          {retrait.map(e=>(
            <div key={e.id} className="text-3xl mb-2">
              {e.nom} #{e.regle_retrait}
            </div>
          ))}
        </div>

      </div>

    </div>

  )
}
