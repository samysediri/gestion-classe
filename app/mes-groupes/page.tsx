"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useRouter } from "next/navigation"

export default function MesGroupes(){

  const [groupes,setGroupes] = useState<any[]>([])
  const router = useRouter()

  async function chargerGroupes(){
    const {data} = await supabase
      .from("groupes")
      .select("*")

    setGroupes(data || [])
  }

  useEffect(()=>{
    chargerGroupes()
  },[])

  return(

    <div className="p-10">

      <h1 className="text-4xl mb-10">
        Mes groupes
      </h1>

      <div className="grid grid-cols-2 gap-6">

        {groupes.map(g =>(

          <button
            key={g.id}
            onClick={()=> router.push(`/telecommande/${g.id}`)}
            className="bg-blue-500 text-white text-3xl p-10 rounded-xl"
          >
            {g.nom}
          </button>

        ))}

      </div>

    </div>

  )
}
