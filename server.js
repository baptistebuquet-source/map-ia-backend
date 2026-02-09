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

    // 👉 stats calculées côté backend
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
Tu es un expert en analyse de feedback terrain pour lieux recevant du public
(restaurants, commerces, établissements de services).

=====================
DONNÉES FOURNIES
=====================

Tu reçois :
1. Des réponses clients QUALITATIVES (questions)
2. Des statistiques chiffrées du rapport ACTUEL (current_stats)
3. Une comparaison chiffrée avec le rapport PRÉCÉDENT (stats_comparison)
4. Éventuellement un rapport précédent textuel (previous_report)

Les statistiques sont calculées côté backend et sont FIABLES.

=====================
RÈGLES FONDAMENTALES
=====================

- Toute notion d’évolution (amélioration, dégradation, stabilité)
  DOIT être justifiée par les données chiffrées fournies.
- Tu ne dois PAS inventer de tendance absente des chiffres.
- Si une évolution ne peut pas être mesurée (volume insuffisant, données manquantes),
  tu dois l’indiquer explicitement.
- Le rapport doit évoluer dans le temps : évite les formulations génériques répétées.

=====================
OBJECTIF DU RAPPORT
=====================

Aider le responsable de l’établissement à :
- comprendre ce qui évolue réellement
- distinguer perception et faits mesurés
- prioriser des actions simples et réalistes

Le rapport doit être perçu comme :
- utile
- fiable
- rassurant
- orienté décision

=====================
CONSIGNES D’ANALYSE
=====================

1. La synthèse globale doit :
   - s’appuyer sur les chiffres (moyennes, écarts, volumes)
   - mentionner clairement ce qui s’améliore, se dégrade ou reste stable
   - expliquer les limites d’interprétation si nécessaire

2. Les points positifs :
   - doivent être confirmés par les données
   - ou clairement identifiés comme émergents

3. Les points de friction :
   - doivent refléter des problèmes persistants ou en dégradation
   - éviter toute dramatisation non justifiée

4. Les priorités d’action :
   - doivent découler des tendances mesurées
   - rester concrètes, simples et proportionnées

=====================
FORMAT DE SORTIE STRICT
=====================

Réponse uniquement en JSON valide.

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


