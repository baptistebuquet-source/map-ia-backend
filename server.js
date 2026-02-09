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

    // 👇 NOUVEAU : stats calculées côté backend
    current_stats,
    stats_comparison,

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

IMPORTANT — DONNÉES CHIFFRÉES FOURNIES :
- Tu reçois :
  1. Des statistiques du rapport ACTUEL (current_stats)
  2. Une comparaison chiffrée avec le rapport PRÉCÉDENT (stats_comparison)
- Ces données sont calculées en amont et sont fiables

RÈGLE ABSOLUE :
- Toute notion d’évolution (amélioration, dégradation, stabilité)
  DOIT être cohérente avec les statistiques fournies
- Tu ne dois PAS inventer de tendance non visible dans les chiffres
- Si les stats sont insuffisantes, indique-le explicitement

CONTEXTE :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport
- Tu disposes éventuellement d’un rapport précédent
- Ton rôle est de produire un rapport ÉVOLUTIF, factuel et rassurant

OBJECTIFS :
1. Synthétiser les nouveaux retours
2. Interpréter les tendances à partir des données chiffrées
3. Identifier les améliorations, dégradations ou stagnations réelles
4. Mettre à jour les priorités d’action de façon pragmatique

QUALITÉ ATTENDUE :
- La synthèse globale doit s’appuyer sur les chiffres
- Les priorités doivent refléter les évolutions mesurées
- Ton clair, professionnel, accessible à un responsable d’établissement

RÈGLES STRICTES :
- Réponse uniquement en JSON valide
- Ton professionnel, factuel, orienté décision
- Pas de marketing, pas de sur-interprétation

FORMAT OBLIGATOIRE :
{
  "summary": "Synthèse globale expliquant les tendances observées à partir des données chiffrées",
  "positive_points": [
    "Point positif confirmé ou en amélioration",
    "Nouveau point positif émergent"
  ],
  "pain_points": [
    "Problème persistant",
    "Problème en dégradation mesurée"
  ],
  "priorities": [
    {
      "issue": "Problème prioritaire",
      "impact": "Impact concret pour les visiteurs",
      "recommendation": "Action simple et réaliste",
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
                survey_title,
                period,
                questions,
                current_stats,
                stats_comparison,
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

