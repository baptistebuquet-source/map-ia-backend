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

/* =====================================================
   =====================================================
   ANALYZE SURVEY
   =====================================================
   ===================================================== */

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
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `
Tu es un consultant expert en analyse de retours clients.

⚠️ RÈGLE ABSOLUE :
Tu ne dois JAMAIS inventer.
Tu ne dois JAMAIS extrapoler sans données.
Tu ne dois JAMAIS créer un scénario implicite.

Si les données sont faibles :
→ Tu dois le dire clairement.
→ Tu dois limiter ton analyse aux faits observables.

Le contexte de l’établissement :
→ Ne doit JAMAIS être la base de ton analyse.
→ Peut uniquement servir à adapter une recommandation.

OBJECTIF DU RAPPORT :
- Synthèse structurée en plusieurs paragraphes clairs
- Analyse argumentée
- Nuance
- Pas d'alarmisme
- Pas de généralisation abusive

FORMAT STRICT JSON :

{
  "summary": "...",
  "positive_points": [],
  "pain_points": [],
  "priorities": [
    {
      "issue": "...",
      "impact": "...",
      "recommendation": "...",
      "evolution": "nouveau"
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

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", errText);
      throw new Error("OpenAI API failed");
    }

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


/* =====================================================
   =====================================================
   GENERATE QUESTIONS
   =====================================================
   ===================================================== */

app.post("/generate-questions", async (req, res) => {

  const {
    establishment,
    establishment_context,
    survey_title
  } = req.body;

  if (!survey_title) {
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
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `
Tu es expert en conception de questionnaires courts, efficaces et professionnels.

OBJECTIF :
Générer entre 4 et 6 questions pertinentes,
adaptées au nom du questionnaire et au contexte.

⚠️ RÈGLE ABSOLUE :

Tu ne dois PAS générer de questions si :

- le titre du questionnaire est trop vague
- le titre ne permet pas de comprendre l’objectif du questionnaire
- le contexte est absent ET le titre est imprécis
- les informations sont incohérentes ou insuffisantes

Dans ces cas :

→ Ne génère aucune question  
→ Explique brièvement le problème  
→ Retourne le JSON spécial indiqué plus bas  

RÈGLES :

- Questions claires
- Une idée par question
- Pas de doublons
- Pas de généralités vagues
- Pas de question inutile
- Pas de question hors sujet
- Maximum 6 questions
- Questions directement exploitables

UTILISATION DU CONTEXTE :

- Le contexte sert uniquement à affiner la pertinence
- Il ne doit jamais remplacer l’objectif du questionnaire
- Ne pas extrapoler au-delà des informations données

TYPES AUTORISÉS :
- rating
- choice
- binary
- open

Pour les questions "choice" :
→ Fournir 3 à 5 options pertinentes
→ allow_multiple = true uniquement si logique

FORMAT JSON STRICT :

SI génération possible :

{
  "status": "ok",
  "questions": [
    {
      "question_text": "...",
      "question_type": "rating | choice | binary | open",
      "allow_multiple": false,
      "options": []
    }
  ]
}

SI données insuffisantes :

{
  "status": "insufficient_data",
  "message": "Titre trop vague ou contexte insuffisant pour générer des questions pertinentes."
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                establishment,
                establishment_context,
                survey_title
              })
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", errText);
      throw new Error("OpenAI API failed");
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty AI response");
    }

    const parsed = JSON.parse(content);
    res.json(parsed);

  } catch (err) {
    console.error("🔥 GENERATE ERROR:", err);
    res.status(500).json({ error: "AI generation failed" });
  }

});


/* =====================
   START SERVER
===================== */

app.listen(PORT, () => {
  console.log(`🚀 IA backend running on port ${PORT}`);
});

