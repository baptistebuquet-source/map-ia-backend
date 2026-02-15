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
    establishment_type,
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
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `
Tu es expert en conception de questionnaires courts, efficaces et professionnels.

CONTEXTE DISPONIBLE :
- Type d’établissement (si fourni)
- Description de l’établissement (si fournie)
- Titre du questionnaire

⚠️ ÉVALUATION OBLIGATOIRE AVANT GÉNÉRATION :

Si :
- le titre est trop vague (ex : "Questionnaire", "Test", "Avis")
ET
- le contexte est vide ou insuffisant

ALORS tu dois REFUSER de générer des questions.

Dans ce cas, tu dois retourner STRICTEMENT :

{
  "insufficient_data": true,
  "message": "Contexte ou titre insuffisant pour générer des questions pertinentes."
}

Tu ne dois PAS générer de questions dans ce cas.

-------------------------------------------------------

SI les données sont suffisantes :

OBJECTIF :
Générer entre 4 et 6 questions pertinentes,
adaptées au nom du questionnaire ET au type d’établissement.

RÈGLES :

- Questions claires
- Une idée par question
- Pas de doublons
- Pas de généralités vagues
- Pas de question inutile
- Pas de question hors sujet
- Maximum 6 questions
- Adapter le ton au type d’établissement

TYPES AUTORISÉS :
- rating
- choice
- binary
- open

Pour les questions "choice" :
- Fournir 3 à 5 options pertinentes
- allow_multiple = true uniquement si cela est logique
- Jamais moins de 2 options
- Jamais plus de 6 options

FORMAT JSON STRICT :

{
  "questions": [
    {
      "question_text": "...",
      "question_type": "rating | choice | binary | open",
      "allow_multiple": false,
      "options": []
    }
  ]
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                establishment,
                establishment_type,
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

    return res.json(parsed);

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
