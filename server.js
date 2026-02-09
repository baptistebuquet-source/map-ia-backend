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
Tu es un expert en analyse de feedback terrain pour organisations recevant du public.

CONTEXTE :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport
- Tu disposes éventuellement d’un rapport précédent
- Les questionnaires sont simples et portent sur des points concrets du quotidien

OBJECTIF PRINCIPAL :
Aider l’établissement à comprendre clairement ce qui fonctionne,
ce qui pose problème, et ce qui mérite d’être priorisé.

IMPORTANT – QUALITÉ DU RAPPORT :
- La synthèse globale doit être DÉTAILLÉE et STRUCTURÉE
- Elle doit expliquer les tendances observées et leur évolution
- Elle doit mentionner ce qui s’améliore, ce qui se dégrade,
  ce qui reste stable ou ce qui mérite une attention particulière
- Ton analytique, clair, accessible à un responsable d’établissement
- Le rapport doit être perçu comme utile et rassurant, pas complexe

RÈGLES STRICTES :
- Réponse uniquement en JSON valide
- Ton professionnel, factuel, sans jargon inutile
- Pas de marketing, pas de suppositions non fondées
- Ne pas sur-interpréter les données

GESTION DE L'ÉVOLUTION :
Pour chaque priorité, tu dois choisir UNE des valeurs suivantes :
- "nouveau" → problème nouvellement identifié
- "en amélioration" → problème toujours présent mais en nette amélioration
- "persistant" → problème stable, sans amélioration notable
- "à surveiller" → signaux faibles ou évolution incertaine
- "en dégradation" → problème qui s’aggrave clairement

N’utilise AUCUNE autre valeur.

FORMAT OBLIGATOIRE :
{
  "summary": "Synthèse globale détaillée des retours et de leur évolution",
  "positive_points": [
    "Point positif confirmé ou en amélioration",
    "Nouveau point positif identifié"
  ],
  "pain_points": [
    "Problème récurrent",
    "Problème nouvellement apparu"
  ],
  "priorities": [
    {
      "issue": "Problème prioritaire",
      "impact": "Impact concret pour les visiteurs",
      "recommendation": "Action simple et concrète à envisager",
      "evolution": "nouveau | persistant | en amélioration | à surveiller | en dégradation"
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

