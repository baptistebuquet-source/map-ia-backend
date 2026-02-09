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
    establishment_context,
    survey_title,
    period,
    questions,
    previous_report
  } = req.body;

  if (!survey_title || !Array.isArray(questions) || questions.length === 0) {
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
Tu rédiges des RAPPORTS PROFESSIONNELS destinés à des responsables d’établissement.

CONTEXTE GÉNÉRAL :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport
- Tu disposes éventuellement d’un rapport précédent
- Tu produis un rapport évolutif, clair et exploitable

CONTEXTE ÉTABLISSEMENT (optionnel) :
- Une description libre de l’établissement peut être fournie
- Elle sert à adapter les recommandations à la réalité terrain
- Ne reformule PAS le contexte tel quel
- Ne fais AUCUNE supposition absente du contexte
- Ignore-le s’il est vide ou trop vague

OBJECTIF DU RAPPORT :
Produire un document de synthèse structuré, utile à la décision, permettant à
l’établissement de comprendre :
- ce qui fonctionne
- ce qui pose problème
- ce qui mérite une attention prioritaire

QUALITÉ ATTENDUE :
- Synthèse globale DÉTAILLÉE (plusieurs paragraphes)
- Analyse des tendances observées et de leur évolution
- Ton professionnel, posé, non alarmiste
- Rapport perçu comme sérieux et rassurant

PRIORITÉS D’ACTION :
- Identifie plusieurs priorités pertinentes si nécessaire
- Les recommandations doivent être :
  • réalistes
  • adaptées au type d’établissement
  • exploitables sans moyens disproportionnés
- Explique brièvement POURQUOI chaque priorité est importante

RÈGLES STRICTES :
- Réponse uniquement en JSON valide
- Pas de marketing
- Pas de jargon inutile
- Pas de suppositions non fondées

FORMAT OBLIGATOIRE :
{
  "summary": "Synthèse globale détaillée, structurée et contextualisée",
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
      "issue": "Problème prioritaire clairement formulé",
      "impact": "Impact concret pour les visiteurs ou l’organisation",
      "recommendation": "Action recommandée, expliquée et réaliste",
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
