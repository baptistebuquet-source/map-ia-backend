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
  const {
    establishment,
    establishment_context, // 👈 NOUVEAU
    survey_title,
    period,
    questions,
    previous_report
  } = req.body;

  if (
    !survey_title ||
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    return res.status(400).json({ error: "Invalid payload" });
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
          temperature: 0.25,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `
Tu es un expert en analyse de feedback terrain pour lieux recevant du public.

CONTEXTE GÉNÉRAL :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport
- Tu disposes éventuellement d’un rapport précédent
- Tu produis un rapport ÉVOLUTIF, factuel et orienté décision

CONTEXTE ÉTABLISSEMENT (optionnel) :
- Tu peux recevoir une description libre de l’établissement
  (activité, clientèle, positionnement, contraintes, objectifs).
- Ce contexte sert uniquement à :
  • adapter la pertinence des recommandations
  • éviter des actions irréalistes ou hors périmètre
  • mieux comprendre certaines contraintes terrain

RÈGLES SUR LE CONTEXTE :
- Ne reformule PAS le contexte tel quel dans le rapport
- N’invente aucune information absente du contexte
- Si le contexte est vague ou vide, ignore-le simplement
- Utilise-le uniquement s’il améliore la qualité des recommandations

OBJECTIFS :
1. Synthétiser les nouveaux retours clients
2. Comparer avec le rapport précédent si fourni
3. Identifier améliorations, dégradations ou stagnations
4. Proposer des priorités d’action réalistes et actionnables

RÈGLES STRICTES :
- Réponse uniquement en JSON valide
- Ton professionnel, clair, factuel
- Pas de marketing, pas de suppositions non fondées

FORMAT OBLIGATOIRE :
{
  "summary": "Résumé global incluant l’évolution par rapport au précédent rapport",
  "positive_points": [
    "Point positif confirmé ou en amélioration",
    "Nouveau point positif émergent"
  ],
  "pain_points": [
    "Problème persistant",
    "Nouveau problème identifié"
  ],
  "priorities": [
    {
      "issue": "Problème prioritaire",
      "impact": "Impact pour les visiteurs",
      "recommendation": "Action concrète et réaliste",
      "evolution": "en amélioration | stable | en dégradation | nouveau"
    }
  ]
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                establishment,
                establishment_context,
                survey_title,
                period,
                questions,
                previous_report
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
    res.status(500).json({ error: "AI analysis failed" });
  }
});

/* =====================
   START SERVER
===================== */

app.listen(PORT, () => {
  console.log(`🚀 IA backend running on port ${PORT}`);
});
;
