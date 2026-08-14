import { NextResponse } from "next/server"

type Student = {
  key: string
  x: number
  y: number
  negative: number
  bravos: number
}

type Event = {
  session: number
  student: string
  action: string
  phase: string | null
  x: number | null
  y: number | null
  timestamp: string
}

type Body = {
  grid?: { cols: number; rows: number }
  students?: Student[]
  events?: Event[]
  sessionCount?: number
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    confidence: { type: "string", enum: ["faible", "moderee", "elevee"] },
    summary: { type: "string" },
    limitations: { type: "array", items: { type: "string" } },
    moves: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          student: { type: "string" },
          x: { type: "integer", minimum: 0, maximum: 6 },
          y: { type: "integer", minimum: 0, maximum: 4 },
          reason: { type: "string" },
        },
        required: ["student", "x", "y", "reason"],
      },
    },
    signals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          strength: { type: "string", enum: ["faible", "moderee", "forte"] },
        },
        required: ["title", "explanation", "strength"],
      },
    },
  },
  required: ["confidence", "summary", "limitations", "moves", "signals"],
} as const

function extractText(response: any) {
  if (typeof response?.output_text === "string") return response.output_text
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text
    }
  }
  return null
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY n'est pas configurée sur le serveur." },
        { status: 503 }
      )
    }

    const body = (await request.json()) as Body
    const students = Array.isArray(body.students) ? body.students.slice(0, 40) : []
    const events = Array.isArray(body.events) ? body.events.slice(-1200) : []
    const grid = body.grid ?? { cols: 7, rows: 5 }

    if (students.length < 2) {
      return NextResponse.json({ error: "Pas assez d'élèves pour analyser le plan." }, { status: 400 })
    }

    const prompt = {
      task: "Proposer un plan de classe exploratoire à partir de données comportementales pseudonymisées.",
      constraints: {
        language: "français",
        grid,
        oneStudentPerSeat: true,
        useOnlyStudentKeysProvided: true,
        preserveStudentCount: true,
        avoidCausalClaims: true,
        teacherZone: "Le bas de la grille (y=4) est le plus proche de la zone enseignant.",
      },
      interpretation: [
        "negative compte les interventions négatives observées.",
        "bravos compte les renforcements positifs observés.",
        "Les événements contiennent la phase de cours et, lorsque disponibles, les positions historiques.",
        "Cherche des motifs répétés de voisinage, de zone, de phase et d'évolution temporelle.",
        "Une corrélation n'est pas une causalité. Quand les données sont faibles, conserve le plan ou propose peu de changements.",
        "Déplace le moins d'élèves possible. Chaque déplacement doit avoir une justification fondée sur les données fournies.",
        "N'invente aucune information personnelle ou psychologique sur les élèves.",
      ],
      sessionCount: body.sessionCount ?? 0,
      students,
      events,
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.1",
        reasoning: { effort: "medium" },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Tu es le moteur analytique de Klimato, un outil d'aide à la gestion de classe. Analyse uniquement les données fournies. Sois prudent, explicable, parcimonieux dans les déplacements et explicite sur les limites. Ne fais jamais de diagnostic sur un élève.",
              },
            ],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(prompt) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "klimato_seating_plan",
            strict: true,
            schema,
          },
        },
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error("OpenAI seating analysis error", data)
      return NextResponse.json({ error: "L'analyse IA a échoué." }, { status: 502 })
    }

    const text = extractText(data)
    if (!text) return NextResponse.json({ error: "Réponse IA vide." }, { status: 502 })

    const result = JSON.parse(text)
    const allowed = new Set(students.map((s) => s.key))
    const occupied = new Set<string>()
    const cleanMoves = []

    for (const move of result.moves ?? []) {
      if (!allowed.has(move.student)) continue
      const x = Number(move.x)
      const y = Number(move.y)
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) continue
      const seatKey = `${x},${y}`
      if (occupied.has(seatKey)) continue
      occupied.add(seatKey)
      cleanMoves.push({ ...move, x, y })
    }

    return NextResponse.json({ ...result, moves: cleanMoves })
  } catch (error) {
    console.error("Klimato AI seating route", error)
    return NextResponse.json({ error: "Erreur serveur pendant l'analyse IA." }, { status: 500 })
  }
}
