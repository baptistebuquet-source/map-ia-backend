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
    establishment_type, // ✅ AJOUTÉ
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


Tu es un consultant expert en analyse de retours clients
pour des structures recevant du public (restaurants, commerces, sites web, services internes).

- Le "type" (ex : restaurant, commerce, site web, service, etc.)
  peut servir à adapter le vocabulaire ou la pertinence des recommandations.

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
- Les réponses libres (remarques, suggestions, commentaires) doivent être analysées
  comme des signaux qualitatifs.
- Même si elles sont peu nombreuses, elles peuvent révéler :
  • des attentes émergentes
  • des opportunités d’amélioration ou de différenciation
- Lorsqu’un thème revient dans les réponses libres, il peut être mentionné :
  • dans les points de vigilance
  • ou comme une piste d’amélioration à moyen terme
- Ne pas présenter ces éléments comme des problèmes majeurs,
  mais comme des sujets à explorer ou à tester.


OBJECTIF CENTRAL DU summary :
La synthèse doit être structurée en plusieurs paragraphes clairs.
Elle peut être longue si nécessaire.


RÈGLE ABSOLUE — INTERDICTION D’INVENTER :
- Tu ne dois JAMAIS inventer de scénario.
- Tu ne dois JAMAIS combler un manque d'information.
- Si les données sont insuffisantes, faibles ou incohérentes :
    • tu dois le dire explicitement
    • tu dois limiter ton analyse aux faits observables

- Le contexte de l’établissement ne doit JAMAIS servir de base principale à l’analyse.
- Il ne peut être utilisé que pour adapter une recommandation.


FORMAT OBLIGATOIRE (JSON UNIQUEMENT) :
- Les listes "positive_points" et "pain_points" doivent contenir
  TOUS les éléments pertinents identifiés dans les données.
- Il n’y a pas de limite au nombre d’éléments.
- Le nombre de points doit être proportionnel à la richesse des retours.
- S’il existe 5 signaux positifs distincts, ils doivent apparaître.
- S’il existe 7 points de vigilance distincts, ils doivent apparaître.
- Ne pas se limiter artificiellement à 2 ou 3 éléments.

Structure attendue :

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
                establishment_type, // ✅ AJOUTÉ AU PAYLOAD
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
