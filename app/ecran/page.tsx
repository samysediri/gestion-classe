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

  // logique cumulative (IMPORTANT)
  const manquement = eleves.filter(e => e.niveau >= 1)
  const retenue = eleves.filter(e => e.niveau >= 2)
  const retrait = eleves.filter(e => e.niveau >= 3)

  return(

    <div className="w-screen h-screen flex flex-col bg-gray-100">

      {/* TITRE */}
      <div className="text-center text-6xl font-bold py-8">
        Gestion de classe
      </div>

      {/* COLONNES */}
      <div className="flex flex-1">

        {/* MANQUEMENT */}
        <div className="flex-1 bg-yellow-300 flex flex-col items-center pt-8">
          <div className="text-5xl font-bold mb-6">
            Manquement
          </div>

          <div className="w-full border-t-2 border-black mb-8"></div>

          {manquement.map(e=>(
            <div key={e.id} className="text-7xl mb-8 font-semibold">
              {e.nom} #{e.regle_manquement}
            </div>
          ))}
        </div>

        {/* RETENUE */}
        <div className="flex-1 bg-orange-300 flex flex-col items-center pt-8">
          <div className="text-5xl font-bold mb-6">
            Retenue
          </div>

          <div className="w-full border-t-2 border-black mb-8"></div>

          {retenue.map(e=>(
            <div key={e.id} className="text-7xl mb-8 font-semibold">
              {e.nom} #{e.regle_retenue}
            </div>
          ))}
        </div>

        {/* RETRAIT */}
        <div className="flex-1 bg-red-300 flex flex-col items-center pt-8">
          <div className="text-5xl font-bold mb-6">
            Retrait
          </div>

          <div className="w-full border-t-2 border-black mb-8"></div>

          {retrait.map(e=>(
            <div key={e.id} className="text-7xl mb-8 font-semibold">
              {e.nom} #{e.regle_retrait}
            </div>
          ))}
        </div>

      </div>

    </div>

  )
}
