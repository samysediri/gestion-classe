"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Page() {

  const [eleves,setEleves] = useState<any[]>([])
  const [selection,setSelection] = useState<number|null>(null)

  async function chargerEleves(){

    const {data} = await supabase
      .from("eleves")
      .select("*")
      .order("id")

    setEleves(data || [])

  }

  async function ajouterManquement(e:any,regle:number){

    let nouveau = e.niveau + 1
    if(nouveau > 3) nouveau = 3

    let update:any = { niveau:nouveau }

    if(nouveau === 1){
      update.regle_manquement = regle
    }

    if(nouveau === 2){
      update.regle_retenue = regle
    }

    if(nouveau === 3){
      update.regle_retrait = regle
    }

    setEleves(prev =>
      prev.map(el =>
        el.id === e.id ? {...el,...update} : el
      )
    )

    await supabase
      .from("eleves")
      .update(update)
      .eq("id",e.id)

    setSelection(null)

  }

  async function resetClasse(){

    setEleves(prev =>
      prev.map(e => ({
        ...e,
        niveau:0,
        regle_manquement:0,
        regle_retenue:0,
        regle_retrait:0
      }))
    )

    await supabase
      .from("eleves")
      .update({
        niveau:0,
        regle_manquement:0,
        regle_retenue:0,
        regle_retrait:0
      })
      .neq("id",0)

  }

  function couleur(niveau:number){

    if(niveau === 0) return "bg-blue-500"
    if(niveau === 1) return "bg-yellow-500"
    if(niveau === 2) return "bg-orange-500"
    return "bg-red-500"

  }

  useEffect(()=>{
    chargerEleves()
  },[])

  return(

    <div className="p-10">

      <h1 className="text-3xl mb-10">
        Télécommande professeur
      </h1>

      <button
        onClick={resetClasse}
        className="mb-8 bg-black text-white px-6 py-3 rounded-xl"
      >
        RESET CLASSE
      </button>

      <div className="grid grid-cols-3 gap-6">

        {eleves.map(e =>(

          <div key={e.id}>

            <button
              onClick={()=> setSelection(e.id)}
              className={`${couleur(e.niveau)} text-white p-6 rounded-xl text-xl w-full`}
            >
              {e.nom}
            </button>

            {selection === e.id && (

              <select
                className="mt-2 p-2 w-full border"
                onChange={(event)=>{

                  const regle = Number(event.target.value)

                  if(regle > 0){
                    ajouterManquement(e,regle)
                  }

                }}
              >

                <option value="0">
                  Choisir une règle
                </option>

                <option value="1">règle 1</option>
                <option value="2">règle 2</option>
                <option value="3">règle 3</option>
                <option value="4">règle 4</option>

              </select>

            )}

          </div>

        ))}

      </div>

    </div>

  )

}