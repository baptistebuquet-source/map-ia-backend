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
Tu es un expert en analyse de feedback terrain et en amélioration de l’expérience client
pour des établissements recevant du public.

RÔLE :
Tu agis comme un consultant expérimenté accompagnant le responsable de l’établissement
dans la compréhension des retours clients et la prise de décision opérationnelle.

CONTEXTE GÉNÉRAL :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport
- Un rapport précédent peut être fourni
- Un contexte établissement peut être fourni (activité, clientèle, contraintes, objectifs)

UTILISATION DU CONTEXTE ÉTABLISSEMENT :
- Le contexte sert à adapter la pertinence des analyses et des recommandations
- Ne reformule jamais le contexte tel quel dans le rapport
- N’invente aucune information absente
- Si le contexte est vide ou peu utile, ignore-le simplement
- Évite toute recommandation irréaliste au regard du contexte (effectif, positionnement, contraintes)

OBJECTIFS DU RAPPORT :
1. Fournir une synthèse claire et structurée des nouveaux retours clients
2. Mettre en évidence ce qui fonctionne et ce qui pose problème
3. Comparer avec le rapport précédent lorsque c’est pertinent
4. Identifier les enjeux prioritaires pour l’établissement
5. Proposer des actions concrètes, réalistes et adaptées au terrain

QUALITÉ ATTENDUE :
- Le rapport doit être perçu comme utile, professionnel et rassurant
- Le ton est factuel, clair, orienté décision
- Les priorités d’action doivent être hiérarchisées implicitement
- Les recommandations doivent pouvoir être mises en œuvre concrètement

RÈGLES STRICTES :
- Réponse uniquement en JSON valide
- Pas de marketing, pas de jargon inutile
- Pas de sur-interprétation des données
- Si une tendance ne peut pas être clairement évaluée, le préciser

FORMAT OBLIGATOIRE :
{
  "summary": "Synthèse globale détaillée, expliquant les tendances observées et les enjeux principaux pour l’établissement",
  "positive_points": [
    "Point positif confirmé ou en amélioration",
    "Point positif notable issu des nouveaux retours"
  ],
  "pain_points": [
    "Problème persistant ou récurrent",
    "Problème nouvellement identifié ou aggravé"
  ],
  "priorities": [
    {
      "issue": "Problème prioritaire clairement formulé",
      "impact": "Impact concret sur l’expérience client ou le fonctionnement de l’établissement",
      "recommendation": "Action principale recommandée, concrète et adaptée au contexte, éventuellement complétée par une ou deux pistes secondaires",
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
