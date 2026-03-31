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

    const interval = setInterval(()=>{
      chargerEleves()
    },1000)

    return ()=> clearInterval(interval)

  },[])

  const manquement = eleves.filter(e => e.niveau >= 1)
  const retenue = eleves.filter(e => e.niveau >= 2)
  const retrait = eleves.filter(e => e.niveau >= 3)

  return(

    <div className="p-10">

      <h1 className="text-4xl font-bold mb-10 text-center">
        Gestion de classe
      </h1>

      <div className="grid grid-cols-3 gap-10 text-center">

        <div className="bg-yellow-200 p-6 rounded-xl">

          <h2 className="text-2xl font-bold mb-4">
            Manquement
          </h2>

          {manquement.map(e=>(
            <div key={e.id} className="text-xl">
              {e.nom} #{e.regle_manquement}
            </div>
          ))}

        </div>


        <div className="bg-orange-200 p-6 rounded-xl">

          <h2 className="text-2xl font-bold mb-4">
            Retenue
          </h2>

          {retenue.map(e=>(
            <div key={e.id} className="text-xl">
              {e.nom} #{e.regle_retenue}
            </div>
          ))}

        </div>


        <div className="bg-red-200 p-6 rounded-xl">

          <h2 className="text-2xl font-bold mb-4">
            Retrait
          </h2>

          {retrait.map(e=>(
            <div key={e.id} className="text-xl">
              {e.nom} #{e.regle_retrait}
            </div>
          ))}

        </div>

      </div>

    </div>

  )

}