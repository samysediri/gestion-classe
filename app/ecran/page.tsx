"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ecran(){

  const [eleves,setEleves] = useState<any[]>([])

  async function chargerEleves(){

    // 🔥 récupérer groupe actif
    const {data:config} = await supabase
      .from("config")
      .select("*")
      .eq("id",1)
      .single()

    if(!config) return

    const groupeId = config.groupe_actif

    const {data} = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id",groupeId)

    setEleves(data || [])
  }

  useEffect(()=>{
    chargerEleves()
    const interval = setInterval(chargerEleves,1000)
    return ()=> clearInterval(interval)
  },[])

  function getTextSize(count:number){
    if(count <= 3) return "text-7xl"
    if(count <= 5) return "text-6xl"
    if(count <= 7) return "text-5xl"
    return "text-4xl"
  }

  const manquement = eleves.filter(e => e.niveau >= 1)
  const retenue = eleves.filter(e => e.niveau >= 2)
  const retrait = eleves.filter(e => e.niveau >= 3)

  return(

    <div className="w-screen h-screen flex bg-gray-100">

      <div className="flex-1 flex flex-col bg-yellow-300 border-r-4 border-white">
        <div className="w-full bg-yellow-600 text-white text-center text-5xl font-bold py-6">
          Manquement
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          {manquement.slice().reverse().map(e=>(
            <div key={e.id} className={`${getTextSize(manquement.length)} mb-6 font-bold text-gray-900`}>
              {e.nom} #{e.regle_manquement}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-orange-300 border-r-4 border-white">
        <div className="w-full bg-orange-600 text-white text-center text-5xl font-bold py-6">
          Retenue
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          {retenue.slice().reverse().map(e=>(
            <div key={e.id} className={`${getTextSize(retenue.length)} mb-6 font-bold text-gray-900`}>
              {e.nom} #{e.regle_retenue}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-red-300">
        <div className="w-full bg-red-600 text-white text-center text-5xl font-bold py-6">
          Retrait
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          {retrait.slice().reverse().map(e=>(
            <div key={e.id} className={`${getTextSize(retrait.length)} mb-6 font-bold text-gray-900`}>
              {e.nom} #{e.regle_retrait}
            </div>
          ))}
        </div>
      </div>

    </div>

  )
}
