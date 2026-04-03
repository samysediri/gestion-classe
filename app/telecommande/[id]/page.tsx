"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabase"
import { useParams } from "next/navigation"

export default function Page() {

  const [eleves,setEleves] = useState<any[]>([])
  const [selection,setSelection] = useState<number|null>(null)

  const [multiMode,setMultiMode] = useState(false)
  const [multiSelection,setMultiSelection] = useState<number[]>([])
  const [showMultiSelect,setShowMultiSelect] = useState(false)

  const params = useParams()
  const groupeId = Number(params.id)

  // 🔥 charger élèves
  async function chargerEleves(){
    const {data} = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id",groupeId)
      .order("id")

    setEleves(data || [])
  }

  // 🔥 entrer groupe (blocage)
  async function entrerGroupe(){

    const { data } = await supabase
      .from("config")
      .select("*")
      .eq("id",1)
      .single()

    if(data.en_cours && data.groupe_actif !== groupeId){
      alert("Un autre groupe est déjà en cours")
      return false
    }

    await supabase
      .from("config")
      .update({
        groupe_actif: groupeId,
        en_cours: true
      })
      .eq("id",1)

    return true
  }

  // 🔥 appliquer règle
  async function appliquerRegle(e:any,regle:number){

    let nouveau = e.niveau + 1
    if(nouveau > 3) nouveau = 3

    let update:any = { niveau:nouveau }

    if(nouveau === 1) update.regle_manquement = regle
    if(nouveau === 2) update.regle_retenue = regle
    if(nouveau === 3) update.regle_retrait = regle

    setEleves(prev =>
      prev.map(el =>
        el.id === e.id ? {...el,...update} : el
      )
    )

    await supabase
      .from("eleves")
      .update(update)
      .eq("id",e.id)
  }

  // 🔥 multi
  async function appliquerMulti(regle:number){

    const selectionnes = eleves.filter(e =>
      multiSelection.includes(e.id)
    )

    for(const e of selectionnes){
      await appliquerRegle(e,regle)
    }

    setMultiSelection([])
    setShowMultiSelect(false)
    setMultiMode(false)
  }

  // 🔥 quitter
  async function quitterGroupe(){

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
      .eq("groupe_id",groupeId)

    await supabase
      .from("config")
      .update({
        groupe_actif: null,
        en_cours: false
      })
      .eq("id",1)
  }

  function couleur(niveau:number){
    if(niveau === 0) return "bg-blue-500"
    if(niveau === 1) return "bg-yellow-500"
    if(niveau === 2) return "bg-orange-500"
    return "bg-red-500"
  }

  useEffect(()=>{

    async function init(){

      const ok = await entrerGroupe()

      if(ok){
        chargerEleves()
      }

    }

    init()

  },[])

  return(

    <div className="p-10">

      <h1 className="text-3xl mb-6">
        Groupe {groupeId}
      </h1>

      <div className="flex gap-4 mb-8">

        <button
          onClick={quitterGroupe}
          className="bg-red-700 text-white px-6 py-3 rounded-xl"
        >
          QUITTER
        </button>

        <button
          onClick={()=>{
            setMultiMode(!multiMode)
            setMultiSelection([])
            setShowMultiSelect(false)
          }}
          className={`px-6 py-3 rounded-xl ${
            multiMode ? "bg-purple-700 text-white" : "bg-gray-300"
          }`}
        >
          Sélection multiple
        </button>

        {multiMode && multiSelection.length > 0 && (
          <button
            onClick={()=> setShowMultiSelect(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-xl"
          >
            OK ({multiSelection.length})
          </button>
        )}

      </div>

      {showMultiSelect && (
        <select
          autoFocus
          className="mb-8 p-4 text-xl border w-full"
          onChange={(e)=>{
            const regle = Number(e.target.value)
            if(regle > 0){
              appliquerMulti(regle)
            }
          }}
        >
          <option value="0">Choisir une règle</option>
          <option value="1">règle 1</option>
          <option value="2">règle 2</option>
          <option value="3">règle 3</option>
          <option value="4">règle 4</option>
        </select>
      )}

      {/* 🔥 PLAN DE CLASSE */}
      <div className="relative w-full h-[600px] bg-gray-100 border rounded-xl">

        {eleves.map(e =>{

          const isSelected = multiSelection.includes(e.id)

          return(

            <div
              key={e.id}
              style={{
                position: "absolute",
                left: `${(e.position_x || 0) * 120}px`,
                top: `${(e.position_y || 0) * 100}px`
              }}
            >

              <button
                onClick={()=>{

                  if(multiMode){

                    setMultiSelection(prev =>
                      prev.includes(e.id)
                        ? prev.filter(id => id !== e.id)
                        : [...prev,e.id]
                    )

                    return
                  }

                  setSelection(e.id)
                }}
                className={`
                  ${couleur(e.niveau)}
                  text-white px-6 py-4 rounded-xl text-lg
                  ${isSelected ? "ring-4 ring-black" : ""}
                `}
              >
                {e.nom}
              </button>

              {!multiMode && selection === e.id && (

                <select
                  autoFocus
                  className="mt-2 p-2 border w-full"
                  onChange={(event)=>{

                    const regle = Number(event.target.value)

                    if(regle > 0){
                      appliquerRegle(e,regle)
                    }

                  }}
                >

                  <option value="0">Choisir une règle</option>
                  <option value="1">règle 1</option>
                  <option value="2">règle 2</option>
                  <option value="3">règle 3</option>
                  <option value="4">règle 4</option>

                </select>

              )}

            </div>

          )

        })}

      </div>

    </div>

  )

}
