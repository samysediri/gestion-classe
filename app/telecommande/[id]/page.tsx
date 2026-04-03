"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "../../../lib/supabase"
import { useParams } from "next/navigation"

export default function Page() {

  const [eleves,setEleves] = useState<any[]>([])
  const [selection,setSelection] = useState<number|null>(null)

  const [editMode,setEditMode] = useState(false)
  const [dragging,setDragging] = useState<any|null>(null)

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

  // 🔥 LONG PRESS → active mode édition
  function startLongPress(e:any){
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

    <div
      className="p-10 select-none"
      onClick={(e)=>{
        // 🔥 quitter mode édition si on clique ailleurs
        if(editMode && e.target === e.currentTarget){
          setEditMode(false)
        }
      }}
    >

      <h1 className="text-3xl mb-10">
        Plan de classe
      </h1>

      <div
        className="relative w-full h-[600px] bg-gray-100 border rounded-xl"

        onMouseMove={(e)=> handleMove(e.clientX,e.clientY,e.currentTarget)}
        onMouseUp={handleEnd}

        onTouchMove={(e)=> {
          const touch = e.touches[0]
          handleMove(touch.clientX,touch.clientY,e.currentTarget)
        }}
        onTouchEnd={handleEnd}
      >

        {eleves.map(e =>{

          const isDragging = dragging?.id === e.id

          const x = e.tempX ?? (e.position_x || 0) * 120
          const y = e.tempY ?? (e.position_y || 0) * 100

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
                  startLongPress(e)
                }
              }}

              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}

              onTouchStart={(ev)=>{
                ev.preventDefault()

                if(editMode){
                  setDragging(e)
                }else{
                  startLongPress(e)
                }
              }}

              onTouchEnd={cancelLongPress}
            >

              <button
                className={`
                  ${couleur(e.niveau)}
                  text-white px-6 py-4 rounded-xl
                  ${editMode ? "animate-pulse" : ""}
                `}
                onClick={()=> {
                  if(!editMode){
                    setSelection(e.id)
                  }
                }}
              >
                {e.nom}
              </button>

            </div>

          )

        })}

      </div>

    </div>

  )

}
