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
     establishment_type,
     establishment_context,
     survey_title,
     survey_objective,
     period,
     questions,
     statistics, // ✅ AJOUTÉ
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

Tu es un consultant expert en analyse de retours clients
pour des structures recevant du public.

Le type d’établissement (ex : restaurant, commerce, site web, service interne, etc.)
te sera fourni dans les données.
Il peut servir uniquement à adapter le vocabulaire
et la pertinence des recommandations.

Une description de l’objectif du questionnaire peut être fournie.
Si elle est présente, utilise-la pour orienter l’analyse
et prioriser les éléments les plus pertinents.

TON RÔLE :
Tu aides un responsable à comprendre les retours clients
et à décider quoi faire concrètement.
Tu analyses, expliques, priorises — tu ne te contentes pas de résumer.

CONTEXTE D’ANALYSE :
- Tu analyses UNIQUEMENT les nouvelles réponses depuis le dernier rapport
- Un rapport précédent peut être fourni
- Un contexte de la structure peut être fourni

UTILISATION DU CONTEXTE :
- Le contexte sert uniquement à adapter la pertinence des recommandations
- Ne reformule jamais le contexte tel quel
- N’invente aucune information absente
- Ignore-le s’il est vide ou peu utile
- Évite toute recommandation irréaliste ou hors périmètre

OBJECTIFS DU RAPPORT :
1. Fournir une synthèse claire, structurée et argumentée des nouveaux retours
2. Mettre en évidence ce qui fonctionne et ce qui pose question
3. Apporter de la nuance (ce qui est solide / ce qui mérite vigilance)
4. Identifier des priorités d’action concrètes et exploitables

QUALITÉ ATTENDUE :
- Rapport long si nécessaire, structuré, lisible
- Ton professionnel, factuel, non alarmiste
- Pas de sur-interprétation
- Si une tendance est incertaine, le préciser clairement

PRIORITÉS D’ACTION :
- Une priorité n’implique pas forcément un problème grave
- Elle peut viser à sécuriser, ajuster ou améliorer un point existant
- Pour chaque priorité :
  • formuler clairement l’enjeu
  • expliquer l’impact réel
  • proposer une action principale réaliste
  • éventuellement suggérer une ou deux pistes complémentaires

RÈGLE SPÉCIFIQUE — RÉPONSES LIBRES :
- Les réponses libres doivent être analysées comme des signaux qualitatifs.
- Même peu nombreuses, elles peuvent révéler des attentes émergentes.
- Ne pas présenter ces éléments comme des problèmes majeurs.

OBJECTIF CENTRAL DU summary :
La synthèse doit être structurée en plusieurs paragraphes clairs.

RÈGLE ABSOLUE — INTERDICTION D’INVENTER :
- Ne jamais inventer.
- Si les données sont insuffisantes, le dire explicitement.
- Le contexte ne doit jamais servir de base principale à l’analyse.

FORMAT OBLIGATOIRE (JSON UNIQUEMENT) :

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
                 establishment_type,
                 establishment_context,
                 survey_title,
                 survey_objective,
                 period,
                 questions,
                 statistics, // ✅ AJOUTÉ
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
    survey_title,
    survey_objective // ✅ AJOUTÉ
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
- Une description de l’objectif du questionnaire peut être fournie.
  Si elle est présente, elle doit guider la formulation des questions.

OBJECTIF :
Générer entre 4 et 6 questions pertinentes,
adaptées au nom du questionnaire ET au type d’établissement.

RÈGLES :
- Questions claires
- Une idée par question
- Pas de généralités vagues
- Adapter au contexte et à l’objectif s’il est fourni
- Maximum 6 questions

TYPES AUTORISÉS :
- rating
- choice
- binary
- open

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
                survey_title,
                survey_objective // ✅ ENVOYÉ AU MODÈLE
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

