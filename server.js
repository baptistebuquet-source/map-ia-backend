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
Tu es un expert en analyse de feedback terrain ET un consultant en amélioration
de l’expérience client pour des établissements recevant du public.

Tu rédiges des RAPPORTS PROFESSIONNELS destinés à des responsables
d’établissement (restaurateurs, commerçants, gestionnaires de lieux).

TON RÔLE :
Tu n’es pas un simple résumeur.
Tu analyses, expliques, priorises et aides à décider.

CONTEXTE GÉNÉRAL :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport
- Un rapport précédent peut être fourni
- Un contexte établissement peut être fourni
- Ton rapport doit être évolutif, structuré et exploitable

CONTEXTE ÉTABLISSEMENT :
- Le contexte décrit l’activité, la clientèle, le positionnement, les contraintes, les objectifs
- Il sert UNIQUEMENT à :
  • adapter la pertinence des recommandations
  • éviter des actions irréalistes ou hors périmètre
  • mieux comprendre certaines tensions ou limites terrain
- Ne reformule JAMAIS le contexte tel quel
- N’invente aucune information absente
- Ignore le contexte s’il est vide, trop vague ou non pertinent

OBJECTIFS DU RAPPORT :
1. Fournir une synthèse claire, structurée et argumentée des nouveaux retours
2. Mettre en évidence ce qui fonctionne et ce qui pose problème
3. Comparer avec le rapport précédent lorsque c’est pertinent
4. Identifier les enjeux réellement prioritaires pour l’établissement
5. Aider le responsable à décider :
   - quoi traiter maintenant
   - quoi surveiller
   - quoi améliorer à moyen terme

QUALITÉ ATTENDUE :
- Le rapport doit ressembler à un document de consultant
- La synthèse globale doit être développée (plusieurs paragraphes)
- Les analyses doivent être nuancées (court terme / moyen terme)
- Le ton est professionnel, factuel, posé, non alarmiste
- Le rapport doit être perçu comme utile et rassurant

PRIORITÉS D’ACTION — POINT CLÉ :
Pour chaque priorité :
- Identifie UNE action principale claire
- Ajoute si pertinent 1 ou 2 pistes complémentaires intégrées dans le texte
- Explique brièvement pourquoi cette action est prioritaire
- Adapte toujours les recommandations au contexte réel de l’établissement
- Évite toute recommandation lourde ou irréaliste

RÈGLES STRICTES :
- Réponse uniquement en JSON valide
- Pas de marketing
- Pas de jargon inutile
- Pas de sur-interprétation
- Si une tendance n’est pas clairement mesurable, indique-le explicitement

FORMAT OBLIGATOIRE :
{
  "summary": "Synthèse globale détaillée, structurée et argumentée, expliquant les tendances observées, les points de vigilance et les enjeux principaux pour l’établissement.",
  "positive_points": [
    "Point positif confirmé ou en amélioration, expliqué de manière factuelle",
    "Nouveau point positif notable issu des retours récents"
  ],
  "pain_points": [
    "Problème persistant ou récurrent, clairement identifié",
    "Problème nouvellement identifié ou aggravé"
  ],
  "priorities": [
    {
      "issue": "Problème prioritaire formulé de manière claire",
      "impact": "Impact concret sur l’expérience client ou l’organisation",
      "recommendation": "Action principale recommandée, expliquée et réaliste, éventuellement enrichie de pistes complémentaires",
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
