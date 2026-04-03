"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "../../../lib/supabase"
import { useParams } from "next/navigation"

export default function Page() {

  const [eleves,setEleves] = useState<any[]>([])
  const [selection,setSelection] = useState<number|null>(null)

  const [editMode,setEditMode] = useState(false)
  const [dragging,setDragging] = useState<any|null>(null)

  const [multiMode,setMultiMode] = useState(false)
  const [multiSelection,setMultiSelection] = useState<number[]>([])
  const [showMultiSelect,setShowMultiSelect] = useState(false)

  const longPressTimer = useRef<any>(null)

  const params = useParams()
  const groupeId = Number(params.id)

  async function chargerEleves(){
    const {data} = await supabase
      .from("eleves")
      .select("*")
      .eq("groupe_id",groupeId)

    setEleves(data || [])
  }

  // 🔥 position EXACTE (plus de snap)
  async function updatePosition(id:number,x:number,y:number){

    await supabase
      .from("eleves")
      .update({
        position_x: x,
        position_y: y
      })
      .eq("id",id)
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

  useEffect(()=>{
    chargerEleves()
  },[])

  function couleur(niveau:number){
    if(niveau === 0) return "bg-blue-500"
    if(niveau === 1) return "bg-yellow-500"
    if(niveau === 2) return "bg-orange-500"
    return "bg-red-500"
  }

  function startLongPress(){
    longPressTimer.current = setTimeout(()=>{
      setEditMode(true)
    },600)
  }

  function cancelLongPress(){
    clearTimeout(longPressTimer.current)
  }

  function handleMove(clientX:number,clientY:number,container:any){

    if(!dragging) return

    const rect = container.getBoundingClientRect()

    const x = clientX - rect.left
    const y = clientY - rect.top

    setEleves(prev =>
      prev.map(el =>
        el.id === dragging.id
          ? {...el, tempX:x, tempY:y}
          : el
      )
    )
  }

  function handleEnd(){

    if(dragging){

      const el = eleves.find(e=> e.id === dragging.id)

      if(el){
        updatePosition(el.id, el.tempX || 0, el.tempY || 0)
      }

      setDragging(null)
    }
  }

  return(

    <div className="p-6 h-screen overflow-hidden select-none">

      <h1 className="text-3xl mb-4">
        Groupe {groupeId}
      </h1>

      {/* 🔥 BOUTONS */}
      <div className="flex gap-3 mb-4">

        <button
          onClick={quitterGroupe}
          className="bg-red-700 text-white px-4 py-2 rounded-xl"
        >
          QUITTER
        </button>

        <button
          onClick={()=>{
            setMultiMode(!multiMode)
            setMultiSelection([])
            setShowMultiSelect(false)
          }}
          className={`px-4 py-2 rounded-xl ${
            multiMode ? "bg-purple-700 text-white" : "bg-gray-300"
          }`}
        >
          Multi
        </button>

        {multiMode && multiSelection.length > 0 && (
          <button
            onClick={()=> setShowMultiSelect(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-xl"
          >
            OK ({multiSelection.length})
          </button>
        )}

      </div>

      {/* 🔥 SELECT MULTI DIRECT */}
      {showMultiSelect && (
        <select
          autoFocus
          className="mb-4 p-3 border w-full text-lg"
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

      {/* 🔥 PLAN */}
      <div
        className="relative w-full h-[600px] bg-gray-100 border rounded-xl"
        style={{ touchAction:"none" }}

        onClick={(e)=>{
          if(editMode && e.target === e.currentTarget){
            setEditMode(false)
          }
        }}

        onMouseMove={(e)=> handleMove(e.clientX,e.clientY,e.currentTarget)}
        onMouseUp={handleEnd}

        onTouchMove={(e)=>{
          const touch = e.touches[0]
          handleMove(touch.clientX,touch.clientY,e.currentTarget)
        }}
        onTouchEnd={handleEnd}
      >

        {eleves.map(e =>{

          const isDragging = dragging?.id === e.id
          const isSelected = multiSelection.includes(e.id)

          const x = e.tempX ?? e.position_x ?? 0
          const y = e.tempY ?? e.position_y ?? 0

          return(

            <div
              key={e.id}
              style={{
                position:"absolute",
                left:x,
                top:isDragging ? y - 20 : y,
                zIndex: isDragging ? 1000 : 1,
                transform: isDragging ? "scale(1.1)" : "scale(1)"
              }}

              onMouseDown={()=> {
                if(editMode){
                  setDragging(e)
                }else{
                  startLongPress()
                }
              }}

              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}

              onTouchStart={(ev)=>{
                ev.preventDefault()

                if(editMode){
                  setDragging(e)
                }else{
                  startLongPress()
                }
              }}

              onTouchEnd={cancelLongPress}
            >

              <button
                className={`
                  ${couleur(e.niveau)}
                  text-white px-6 py-4 rounded-xl
                  ${editMode ? "animate-pulse" : ""}
                  ${isSelected ? "ring-4 ring-black" : ""}
                `}
                onClick={()=>{
                  if(!editMode){

                    if(multiMode){
                      setMultiSelection(prev =>
                        prev.includes(e.id)
                          ? prev.filter(id => id !== e.id)
                          : [...prev,e.id]
                      )
                    }else{
                      setSelection(e.id)
                    }

                  }
                }}
              >
                {e.nom}
              </button>

              {/* 🔥 POP DIRECT */}
              {!editMode && !multiMode && selection === e.id && (

                <select
                  autoFocus
                  className="mt-2 p-2 border text-lg"
                  onChange={(event)=>{

                    const regle = Number(event.target.value)

                    if(regle > 0){
                      appliquerRegle(e,regle)
                      setSelection(null)
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
