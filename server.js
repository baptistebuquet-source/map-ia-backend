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
    previous_report,
    actions_taken // 👈 maintenant utilisé explicitement
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

IMPORTANT — CONTEXTE D'ÉVOLUTION :
- Certaines priorités contiennent déjà :
  - un champ "evolution" (nouveau | persistant | à surveiller)
  - un champ "action_context" (actions engagées | aucune action déclarée)
- Ces champs ont été calculés en amont.
- TU NE DOIS PAS les recalculer.
- TU DOIS les utiliser pour expliquer, hiérarchiser et contextualiser.

CONTEXTE :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport.
- Tu disposes éventuellement d’un rapport précédent.
- Tu disposes éventuellement d’actions humaines déjà engagées.

OBJECTIFS :
1. Synthétiser les nouveaux retours
2. Mettre en perspective l’évolution des problématiques
3. Identifier les priorités nécessitant une action immédiate
4. Commenter brièvement l’impact des actions déjà engagées lorsqu’elles existent

IMPORTANT – QUALITÉ DU RAPPORT :
- La synthèse globale doit être DÉTAILLÉE et STRUCTURÉE
- Elle doit contextualiser les retours, expliquer les tendances et leurs causes probables
- Elle doit mentionner explicitement les points en amélioration, en dégradation et les points stables
- Longueur attendue : plusieurs phrases, ton analytique, comme un rapport professionnel destiné à un responsable d’établissement

RÈGLES STRICTES :
- Réponse uniquement en JSON valide
- Ton professionnel, factuel, orienté décision
- Pas de marketing, pas de suppositions non fondées
- Ne propose PAS à nouveau une action déjà engagée
- Mets l’accent sur :
  - les problèmes persistants
  - ceux sans action déclarée
  - ceux en dégradation ou à surveiller

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
      "recommendation": "Action concrète recommandée (si aucune action n’est encore engagée)",
      "evolution": "nouveau | persistant | à surveiller",
      "action_context": "actions engagées | aucune action déclarée"
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
                previous_report,
                actions_taken
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
