import express from "express";
import fetch from "node-fetch";

const app = express();

/* =====================
   CONFIG
===================== */

const PORT = process.env.PORT || 3001;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  console.error("❌ OPENAI_API_KEY manquante");
  process.exit(1);
}

/* =====================
   MIDDLEWARE
===================== */

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* =====================
   HEALTH CHECK
===================== */

app.get("/", (_, res) => {
  res.send("✅ IA Survey Analysis API running");
});

/* =====================
   ANALYZE SURVEY
===================== */

app.post("/analyze-survey", async (req, res) => {
  const { establishment, survey_title, questions } = req.body;

  // Validation minimale
  if (
    !survey_title ||
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    return res.status(400).json({
      error: "Invalid payload"
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `
Tu es un expert en analyse de feedback terrain (lieux publics, commerces, musées, restaurants).

OBJECTIF :
Transformer des réponses brutes en décisions claires.

RÈGLES :
- Réponse STRICTEMENT en JSON valide
- Ton clair, professionnel, non marketing
- Analyse orientée action

FORMAT OBLIGATOIRE :
{
  "summary": "Résumé global en 3–4 phrases",
  "positive_points": [
    "Point positif 1",
    "Point positif 2"
  ],
  "pain_points": [
    "Problème récurrent 1",
    "Problème récurrent 2"
  ],
  "priorities": [
    {
      "issue": "Problème prioritaire",
      "impact": "Impact pour les visiteurs",
      "recommendation": "Action concrète recommandée"
    }
  ]
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                establishment,
                survey_title,
                questions
              })
            }
          ]
        }),
      }
    );

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty AI response");
    }

    const parsed = JSON.parse(content);

    res.json(parsed);

  } catch (err) {
    console.error("🔥 ANALYZE ERROR:", err);

    res.status(500).json({
      error: "AI analysis failed"
    });
  }
});

/* =====================
   START SERVER
===================== */

app.listen(PORT, () => {
  console.log(`🚀 IA backend running on port ${PORT}`);
});
