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

  const dragOffset = useRef({x:0,y:0})
  const longPressTimer = useRef<any>(null)

  const params = useParams()
  const groupeId = Number(params.id)

  // 🔥 ENTRER GROUPE (blocage)
  async function entrerGroupe(){

    const { data } = await supabase
      .from("config")
      .select("*")
      .eq("id",1)
      .single()

    if(data?.en_cours && data.groupe_actif !== groupeId){
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
      .update({ position_x:x, position_y:y })
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

    await supabase.from("eleves").update(update).eq("id",e.id)

    setSelection(null)
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

  // 🔥 FIX QUITTER (IMPORTANT)
  async function quitterGroupe(){

    // reset local
    setEleves(prev =>
      prev.map(e => ({
        ...e,
        niveau:0,
        regle_manquement:0,
        regle_retenue:0,
        regle_retrait:0
      }))
    )

    // reset DB élèves
    const { error:err1 } = await supabase
      .from("eleves")
      .update({
        niveau:0,
        regle_manquement:0,
        regle_retenue:0,
        regle_retrait:0
      })
      .eq("groupe_id",groupeId)

    if(err1) console.log("Erreur reset élèves:", err1)

    // libérer config
    const { error:err2 } = await supabase
      .from("config")
      .update({
        groupe_actif:null,
        en_cours:false
      })
      .eq("id",1)

    if(err2) console.log("Erreur config:", err2)

    setSelection(null)
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

  function startDrag(e:any,clientX:number,clientY:number){

    const rect = document.getElementById("btn-"+e.id)?.getBoundingClientRect()
    if(!rect) return

    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top
    }

    setDragging(e)
  }

  function handleMove(clientX:number,clientY:number,container:any){

    if(!dragging) return

    const rect = container.getBoundingClientRect()

    const x = clientX - rect.left - dragOffset.current.x
    const y = clientY - rect.top - dragOffset.current.y

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
        updatePosition(
          el.id,
          el.tempX ?? el.position_x ?? 0,
          el.tempY ?? el.position_y ?? 0
        )
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

        {multiMode && (
          <button
            onClick={()=>{
              setMultiMode(false)
              setMultiSelection([])
            }}
            className="bg-gray-500 text-white px-4 py-2 rounded-xl"
          >
            Annuler
          </button>
        )}

        {multiMode && multiSelection.length > 0 && (
          <button
            onClick={()=> setShowMultiSelect(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-xl"
          >
            OK ({multiSelection.length})
          </button>
        )}

      </div>

      {showMultiSelect && (
        <div className="flex gap-2 mb-4">
          {[1,2,3,4].map(r => (
            <button key={r}
              className="bg-black text-white px-4 py-2 rounded-xl"
              onClick={()=> appliquerMulti(r)}>
              #{r}
            </button>
          ))}
        </div>
      )}

      {/* 🔥 PLAN */}
      <div
        className="relative w-full h-[600px] bg-gray-100 border rounded-xl"
        style={{ touchAction:"none" }}

        onClick={(e)=>{
          if(e.target === e.currentTarget){
            setEditMode(false)
            setSelection(null)
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

          const x = e.tempX ?? e.position_x ?? 0
          const y = e.tempY ?? e.position_y ?? 0

          return(

            <div
              key={e.id}
              style={{
                position:"absolute",
                left:x,
                top:y
              }}

              onMouseDown={(ev)=> {
                if(editMode){
                  startDrag(e,ev.clientX,ev.clientY)
                }else{
                  startLongPress()
                }
              }}

              onTouchStart={(ev)=>{
                const touch = ev.touches[0]

                if(editMode){
                  startDrag(e,touch.clientX,touch.clientY)
                }else{
                  startLongPress()
                }
              }}

              onMouseUp={cancelLongPress}
              onTouchEnd={cancelLongPress}
            >

              <button
                id={"btn-"+e.id}
                className={`${couleur(e.niveau)} text-white px-6 py-4 rounded-xl`}
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

              {!editMode && !multiMode && selection === e.id && (

                <div className="flex gap-2 mt-2">
                  {[1,2,3,4].map(r => (
                    <button key={r}
                      className="bg-black text-white px-3 py-1 rounded-lg"
                      onClick={()=> appliquerRegle(e,r)}>
                      #{r}
                    </button>
                  ))}
                </div>

              )}

            </div>

          )

        })}

      </div>

    </div>

  )
}
