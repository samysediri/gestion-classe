"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useRouter } from "next/navigation"

export default function Page(){

  const [groupes,setGroupes] = useState<any[]>([])
  const [showForm,setShowForm] = useState(false)

  const [numero,setNumero] = useState("")
  const [elevesText,setElevesText] = useState("")

  const router = useRouter()

  // 🔥 charger groupes
  async function chargerGroupes(){

    const {data,error} = await supabase
      .from("groupes")
      .select("*")
      .order("id")

    if(error){
      console.log("ERREUR LOAD GROUPES:", error)
      alert("Erreur chargement groupes")
      return
    }

    console.log("GROUPES:", data)

    setGroupes(data || [])
  }

  useEffect(()=>{
    chargerGroupes()
  },[])

  // 🔥 AJOUT GROUPE
  async function ajouterGroupe(){

    alert("clic détecté") // 🔥 DEBUG

    if(!numero){
      alert("Entre un numéro de groupe")
      return
    }

    console.log("Création groupe:", numero)

    // 🔥 créer groupe
    const {data:groupe,error} = await supabase
      .from("groupes")
      .insert({
        numero: numero
      })
      .select()
      .single()

    if(error){
      console.log("ERREUR INSERT GROUPE:", error)
      alert("Erreur création groupe (regarde console)")
      return
    }

    console.log("GROUPE OK:", groupe)

    const groupeId = groupe.id

    // 🔥 élèves
    const liste = elevesText
      .split("\n")
      .map(n => n.trim())
      .filter(n => n.length > 0)

    const elevesToInsert = liste.map(nom => ({
      nom,
      groupe_id: groupeId,
      niveau:0,
      regle_manquement:0,
      regle_retenue:0,
      regle_retrait:0,
      position_x:0,
      position_y:0
    }))

    if(elevesToInsert.length > 0){

      const {error:errEleves} = await supabase
        .from("eleves")
        .insert(elevesToInsert)

      if(errEleves){
        console.log("ERREUR ELEVE:", errEleves)
        alert("Erreur ajout élèves")
      }
    }

    // reset
    setNumero("")
    setElevesText("")
    setShowForm(false)

    chargerGroupes()
  }

  return(

    <div className="p-10">

      <h1 className="text-3xl mb-6">
        Mes groupes
      </h1>

      <button
        onClick={()=> setShowForm(true)}
        className="mb-6 bg-black text-white px-6 py-3 rounded-xl"
      >
        Ajouter un groupe
      </button>

      {/* FORMULAIRE */}
      {showForm && (

        <div className="mb-10 p-6 border rounded-xl bg-gray-100">

          <h2 className="text-xl mb-4">
            Nouveau groupe
          </h2>

          <input
            placeholder="Numéro du groupe (ex: 101)"
            value={numero}
            onChange={e=> setNumero(e.target.value)}
            className="w-full mb-4 p-3 border rounded"
          />

          <textarea
            placeholder={`Élèves (un par ligne)
Alex
Sarah
Mathis`}
            value={elevesText}
            onChange={e=> setElevesText(e.target.value)}
            className="w-full mb-4 p-3 border rounded h-40"
          />

          <div className="flex gap-3">

            <button
              onClick={ajouterGroupe}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Créer
            </button>

            <button
              onClick={()=> setShowForm(false)}
              className="bg-gray-400 px-4 py-2 rounded"
            >
              Annuler
            </button>

          </div>

        </div>

      )}

      {/* LISTE GROUPES */}

      <div className="grid grid-cols-3 gap-4">

        {groupes.map(g =>(

          <div
            key={g.id}
            className="p-6 bg-blue-500 text-white rounded-xl cursor-pointer text-xl text-center"
            onClick={()=> router.push(`/telecommande/${g.id}`)}
          >
            {g.numero}
          </div>

        ))}

      </div>

    </div>

  )
}
