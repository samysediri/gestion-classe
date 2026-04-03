"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabase"
import { useParams } from "next/navigation"

export default function Page() {

  const [eleves,setEleves] = useState<any[]>([])
  const [selection,setSelection] = useState<number|null>(null)

  const params = useParams()
  const groupeId = Number(params.id)

  // 🔥 drag state
  const [dragging,setDragging] = useState<any|null>(null)

  async function chargerEleves(){
    const {data} = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id",groupeId)

    setEleves(data || [])
  }

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

  // 🔥 sauvegarde position
  async function updatePosition(id:number,x:number,y:number){

    await supabase
      .from("eleves")
      .update({
        position_x: Math.round(x/120),
        position_y: Math.round(y/100)
      })
      .eq("id",id)
  }

  useEffect(()=>{
    chargerEleves()
  },[])

  function couleur(niveau:number){
    if(niveau === 0) return "bg-blue-500"
    if(niveau === 1) return "bg-yellow-500"
    if(niveau === 2) return "bg-orange-500"
    return "bg-red-500"
  }

  return(

    <div className="p-10">

      <h1 className="text-3xl mb-10">
        Plan de classe (drag & drop)
      </h1>

      <div
        className="relative w-full h-[600px] bg-gray-100 border rounded-xl"
        onMouseMove={(e)=>{
          if(!dragging) return

          const rect = e.currentTarget.getBoundingClientRect()

          const x = e.clientX - rect.left
          const y = e.clientY - rect.top

          setEleves(prev =>
            prev.map(el =>
              el.id === dragging.id
                ? {...el, tempX:x, tempY:y}
                : el
            )
          )
        }}
        onMouseUp={()=>{
          if(dragging){

            const el = eleves.find(e=> e.id === dragging.id)

            if(el){
              updatePosition(el.id, el.tempX || 0, el.tempY || 0)
            }

            setDragging(null)
          }
        }}
      >

        {eleves.map(e =>{

          const x = e.tempX ?? (e.position_x || 0) * 120
          const y = e.tempY ?? (e.position_y || 0) * 100

          return(

            <div
              key={e.id}
              style={{
                position:"absolute",
                left:x,
                top:y,
                cursor:"grab"
              }}
              onMouseDown={()=>{
                setDragging(e)
              }}
            >

              <button
                onClick={()=> setSelection(e.id)}
                className={`${couleur(e.niveau)} text-white px-6 py-4 rounded-xl`}
              >
                {e.nom}
              </button>

              {selection === e.id && (

                <select
                  autoFocus
                  className="mt-2 p-2 border"
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
