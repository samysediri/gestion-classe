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

    <div className="w-screen h-screen flex bg-gray-100">

      {/* MANQUEMENT */}
      <div className="flex-1 flex flex-col bg-yellow-300 border-r-4 border-gray-200">

        {/* TITRE */}
        <div className="text-center text-5xl font-bold py-6 border-b-4 border-gray-200">
          Manquement
        </div>

        {/* CONTENU */}
        <div className="flex-1 flex flex-col items-center justify-center">

          {manquement.slice().reverse().map(e=>(
            <div key={e.id} className="text-7xl mb-8 font-bold text-gray-900">
              {e.nom} #{e.regle_manquement}
            </div>
          ))}

        </div>

      </div>

      {/* RETENUE */}
      <div className="flex-1 flex flex-col bg-orange-300 border-r-4 border-gray-200">

        <div className="text-center text-5xl font-bold py-6 border-b-4 border-gray-200">
          Retenue
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">

          {retenue.slice().reverse().map(e=>(
            <div key={e.id} className="text-7xl mb-8 font-bold text-gray-900">
              {e.nom} #{e.regle_retenue}
            </div>
          ))}

        </div>

      </div>

      {/* RETRAIT */}
      <div className="flex-1 flex flex-col bg-red-300">

        <div className="text-center text-5xl font-bold py-6 border-b-4 border-gray-200">
          Retrait
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">

          {retrait.slice().reverse().map(e=>(
            <div key={e.id} className="text-7xl mb-8 font-bold text-gray-900">
              {e.nom} #{e.regle_retrait}
            </div>
          ))}

        </div>

      </div>

    </div>

  )
}
