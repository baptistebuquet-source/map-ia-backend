import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";

const app = express();

app.use(express.json({ limit: "20mb" }));


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

app.post("/analyze-decline", async (req, res) => {

  const {
    establishment_type,
    axis_label,
    question_text,
    current_score,
    delta,
    actions_pool
  } = req.body;

  if (!question_text || !actions_pool || actions_pool.length === 0) {
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
Tu es un consultant senior en stratégie opérationnelle.

Un établissement observe une baisse sur une question précise.

Les actions fournies ont réellement été mises en œuvre par des structures similaires et ont généré une amélioration mesurée (delta_observed) sur un volume réel de réponses (response_count).

Ta mission :

1. Analyser précisément la problématique exprimée dans la question.
2. Évaluer la pertinence DIRECTE des actions fournies.
3. Sélectionner jusqu’à 3 actions maximum.
4. Si une seule est pertinente → retourner 1.
5. Si aucune n’est suffisamment pertinente → retourner une liste vide.
6. Ne jamais inventer d’action.
7. Ne jamais modifier les données statistiques fournies.
8. Ne jamais inventer de delta ou de volume.

CRITÈRES STRICTS :

- L’action doit agir sur la dimension principale de la question.
- Le lien doit être opérationnel et explicite.
- Si le lien est partiel ou secondaire → ne pas sélectionner.

Pour chaque action retenue :

- Reprendre exactement delta_observed et response_count.
- Ne pas les recalculer.
- Ne pas les modifier.

Réponds UNIQUEMENT en JSON au format :

{
  "context_analysis": "...",
  "recommended_actions": [
    {
      "title": "...",
      "justification": "...",
      "expected_impact": "...",
      "delta_observed": 0,
      "response_count": 0
    }
  ]
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                establishment_type,
                axis_label,
                question_text,
                current_score,
                delta,
                actions_pool
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
    console.error("🔥 DECLINE ANALYZE ERROR:", err);
    res.status(500).json({ error: "AI decline analysis failed" });
  }

});






/* =====================================================
   MAP DOCUMENT CONTEXT
   ===================================================== */

app.post("/map-document-context", async (req, res) => {

console.log("===== MAP DOCUMENT CONTEXT CALLED =====");

let { text, file_base64 } = req.body;

console.log("Incoming payload keys:", Object.keys(req.body));

/* ===============================
   Si PDF envoyé
================================ */

if (!text && file_base64) {

console.log("PDF detected");

try {

const buffer = Buffer.from(file_base64, "base64");

const data = await pdf(buffer);

text = data.text;

console.log("Extracted PDF text length:", text.length);

} catch(err){

console.error("PDF extraction error:", err);

return res.status(500).json({
error: "PDF extraction failed"
});

}

}

/* ===============================
   Vérification payload
================================ */

if (!text || text.length < 30) {

console.log("Payload rejected: text too short or missing");

return res.status(400).json({
error: "Invalid payload"
});

}

/* limiter taille */

text = text.slice(0,4000);

try {

console.log("Sending request to OpenAI...");

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
Tu analyses un document décrivant un établissement.

Objectif :
extraire les informations utiles pour comprendre le contexte.

Cherche notamment :

- type d'établissement
- positionnement
- clientèle cible
- ambiance
- services
- particularités

RÈGLES :

- résumé court
- maximum 5 lignes
- ne rien inventer

Réponds en JSON :

{
"summary":"..."
}
`
},
{
role: "user",
content: text
}
]
})
}
);

/* ===============================
   Vérification réponse OpenAI
================================ */

if (!response.ok) {

const errText = await response.text();

console.error("OpenAI API ERROR:", errText);

throw new Error("OpenAI API failed");

}

const data = await response.json();

const content = data?.choices?.[0]?.message?.content;

if (!content) {

console.error("Empty AI response");

throw new Error("Empty AI response");

}

const parsed = JSON.parse(content);

console.log("Parsed summary:", parsed.summary);

res.json(parsed);

} catch (err) {

console.error("🔥 DOCUMENT CONTEXT ERROR:", err);

res.status(500).json({
error: "Document context mapping failed"
});

}

});




/* =====================================================
   ANALYZE INSIGHTS (QUESTIONS INFORMATIONAL)
===================================================== */

app.post("/analyze-insights", async (req, res) => {

  const { questions } = req.body;

  if (!questions || questions.length === 0) {
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
Tu es un analyste expert en expérience client.

Tu reçois des réponses ouvertes issues d’un questionnaire client.

Ta mission :

1. Identifier les thèmes dominants dans les réponses.
2. Résumer les motivations ou attentes principales.
3. Produire une synthèse stratégique utile pour un responsable d’établissement.

RÈGLES :

- Ne jamais répéter les réponses individuellement.
- Produire une synthèse claire et concise.
- Maximum 4 idées principales.
- Ton texte doit être exploitable dans un rapport stratégique.

Réponds UNIQUEMENT en JSON au format :

{
  "insight_text": "Synthèse des enseignements clients..."
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                questions
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
    console.error("🔥 INSIGHT ANALYZE ERROR:", err);
    res.status(500).json({ error: "AI insight analysis failed" });
  }

});









/* =====================================================
   ANALYSIS CHAT
===================================================== */

app.post("/analysis-chat", async (req, res) => {

  const {
    establishment_type,
    establishment_context,
    survey_objective,
    analysis_context,
    conversation
  } = req.body;

  if (!conversation) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {

    const messages = [

      {
        role: "system",
        content: `
Tu es un assistant d'analyse stratégique pour des établissements
(restaurants, boutiques, services).

Tu aides le responsable de l'établissement à comprendre les résultats
de son questionnaire client.

Ton rôle :

- analyser les performances
- expliquer les évolutions
- interpréter les retours clients
- proposer des pistes d'amélioration
- répondre aux questions du responsable

IMPORTANT :

- ne jamais inventer de données
- t'appuyer uniquement sur les données fournies
- être clair et opérationnel
- répondre en français
- rester synthétique (5 à 10 lignes maximum)

En plus de ta réponse, tu dois proposer
3 questions pertinentes que le responsable
pourrait poser pour approfondir l'analyse.

Ces questions doivent être directement liées
aux résultats fournis.

Tu dois répondre STRICTEMENT au format JSON suivant :

{
  "answer": "...",
  "suggestions": [
    "...",
    "...",
    "..."
  ]
}

CONTEXTE :

Type d'établissement :
${establishment_type ?? "non spécifié"}

Contexte établissement :
${establishment_context ?? "non fourni"}

Objectif du questionnaire :
${survey_objective ?? "non fourni"}

SYNTHÈSE CLIENTS :
${analysis_context?.insight ?? "aucune synthèse disponible"}

PERFORMANCES MESURÉES :

${JSON.stringify(analysis_context?.metrics ?? [], null, 2)}

Tu dois répondre comme un consultant stratégique
qui aide le responsable à interpréter les résultats.
`
      }

    ];

    /* =============================
       Ajouter historique conversation
    ============================= */

    for (const msg of conversation) {
      messages.push({
        role: msg.role,
        content: msg.message
      });
    }

    /* =============================
       Appel OpenAI
    ============================= */

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
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: messages
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

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error:", content);
      throw new Error("Invalid AI JSON response");
    }

    const answer = parsed.answer || "Je n'ai pas pu analyser les données.";
    const suggestions = parsed.suggestions || [];

    /* =============================
       Réponse API
    ============================= */

    res.json({
      answer,
      suggestions
    });

  } catch (err) {

    console.error("🔥 ANALYSIS CHAT ERROR:", err);

    res.status(500).json({
      answer: "Une erreur est survenue lors de l'analyse.",
      suggestions: []
    });

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
Tu es un expert senior en conception de questionnaires professionnels, courts et stratégiques.

────────────────────────────
CONTEXTE DISPONIBLE
────────────────────────────

Les éléments suivants peuvent être fournis :

- Type d’établissement
- Description de l’établissement
- Titre du questionnaire
- Description de l’objectif du questionnaire
- Liste de questions déjà existantes

Si un objectif est fourni, il doit guider la sélection des thématiques et la formulation des questions.

Le type et le contexte servent uniquement à adapter la pertinence et le vocabulaire.

────────────────────────────
OBJECTIF
────────────────────────────

Générer entre 4 et 6 questions pertinentes, utiles et exploitables, adaptées :

- au titre du questionnaire
- à son objectif
- au type d’établissement
- au contexte fourni

Les questions doivent permettre une analyse décisionnelle réelle.

────────────────────────────
QUALITÉ ATTENDUE
────────────────────────────

Chaque question doit :

- Être claire et précise
- Contenir une seule idée
- Éviter les formulations vagues
- Éviter les généralités
- Être utile pour la prise de décision
- Être adaptée au contexte réel

Ne pas poser de questions évidentes ou inutiles.

Éviter les formulations trop longues ou complexes.

────────────────────────────
COUVERTURE INTELLIGENTE DES THÉMATIQUES
────────────────────────────

Avant de générer les questions :

1. Identifier mentalement les dimensions déjà couvertes.
2. Identifier les dimensions pertinentes encore non couvertes.
3. Générer uniquement des questions apportant une perspective complémentaire.

Les questions doivent couvrir des axes distincts lorsque cela est possible.

────────────────────────────
CONTRAINTE CRITIQUE — ANTI-DOUBLON STRICT
────────────────────────────

Une liste de questions existantes peut être fournie.

Il est STRICTEMENT INTERDIT de générer :

- une question identique
- une reformulation
- une variation grammaticale
- une question très proche sémantiquement
- une question évaluant la même dimension

Deux questions sont considérées comme similaires si :

- elles mesurent la même idée (ex : accueil, rapidité, confort, satisfaction globale)
- elles abordent le même moment du parcours client
- elles utilisent une formulation différente mais visent le même indicateur

Si une question est trop proche d’une existante :

→ Ne pas la générer  
→ Choisir un angle totalement différent  

Si aucun angle nouveau pertinent n’est possible :

→ Retourner moins de questions  
→ Ne jamais produire un doublon  

La diversité thématique est prioritaire sur la quantité.

────────────────────────────
TYPES AUTORISÉS
────────────────────────────

- rating
- choice
- binary
- open



DÉFINITION STRATÉGIQUE DES RÔLES :

Chaque question doit être associée à :

- un strategic_role cohérent
- un axis_key cohérent parmi les axes fournis

Ne jamais inventer un axis_key en dehors de la liste.

performance :
Indicateur clé de pilotage opérationnel.
Mesure directe d’un levier stratégique central
(service, produit, délai, fidélité, prix).

segmentation :
Variable servant à catégoriser les répondants
(frécence, profil client, canal, type de visite).

informational :
Question qualitative exploratoire
destinée à enrichir la compréhension
mais non utilisée comme KPI principal.

secondary :
Indicateur complémentaire utile
mais non central dans la prise de décision.
À utiliser uniquement si la question
ne constitue ni un KPI principal,
ni une variable de segmentation.


HIÉRARCHIE DÉCISIONNELLE OBLIGATOIRE :

Lors de l’attribution du strategic_role, appliquer l’ordre de priorité suivant :

1. Si la question mesure un levier opérationnel central → performance
2. Sinon si elle sert à profiler le répondant → segmentation
3. Sinon si elle est qualitative exploratoire → informational
4. Sinon → secondary

Ne jamais utiliser "secondary" si la question peut légitimement être classée en performance.


AXES AUTORISÉS (OBLIGATOIRES) :
- service
- product
- fluidity
- experience
- loyalty
- pricing
- logistics

Tu DOIS choisir STRICTEMENT l’un de ces axis_key.
Tout autre valeur est interdite.


RÈGLES SUPPLÉMENTAIRES :

- rating : échelle cohérente et exploitable (ex : 1–5)
- choice : 2 à 6 options maximum
- allow_multiple doit être cohérent avec la logique de la question
- open : uniquement si pertinent

────────────────────────────
FORMAT JSON STRICT — AUCUN TEXTE HORS JSON
────────────────────────────

{
  "questions": [
    {
      "question_text": "...",
      "question_type": "rating | choice | binary | open",
      "allow_multiple": false,
      "options": [],
      "strategic_role": "performance | secondary | segmentation | informational",
      "axis_key": "service | product | fluidity | experience | loyalty | acquisition | clarity | pricing | interface | logistics"
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
   
   console.log("=== IA GENERATE QUESTIONS RESPONSE ===");
   console.log(JSON.stringify(parsed, null, 2));
   
   return res.json(parsed);

  } catch (err) {
    console.error("🔥 GENERATE ERROR:", err);
    res.status(500).json({ error: "AI generation failed" });
  }

});










/* =====================================================
   CLASSIFY QUESTION
===================================================== */

app.post("/classify-question", async (req, res) => {

  const {
    question_text,
    question_type,
    establishment_type,
    available_axes
  } = req.body;

  if (!question_text || !available_axes) {
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
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
         {
           role: "system",
           content: `
         Tu es un expert senior en structuration stratégique de questionnaires.
         
         Tu dois répondre EXCLUSIVEMENT en JSON valide.
         
         OBJECTIF :
         Attribuer obligatoirement :
         
         - un strategic_role
         - un axis_id parmi la liste fournie
         
         ────────────────────────────
         DÉFINITION STRATÉGIQUE DES RÔLES
         ────────────────────────────
         
         1. PERFORMANCE (par défaut pour les indicateurs clés)
         
         Toute question qui :
         
         - Mesure la qualité d’un élément central de l’expérience
         - Mesure un levier opérationnel pilotable
         - Utilise un format rating ou binary sur un axe cœur
         - Concerne : service, produit, délai, expérience, fidélité, prix
         
         → DOIT être classée "performance"
         
         C’est le rôle par défaut sauf justification forte contraire.
         
         2. SECONDARY
         
         Indicateur utile mais non central.
         Complément d’analyse, mais pas un levier stratégique principal.
         
         3. SEGMENTATION
         
         Question servant à profiler les répondants
         (ex : fréquence de visite, type de client, âge, etc.)
         
         4. INFORMATIONAL
         
         Question exploratoire ou qualitative ouverte,
         sans indicateur structurant directement mesurable.
         
         IMPORTANT :
         Une question rating sur un axe opérationnel clé
         NE DOIT PAS être classée informational.
         
         ────────────────────────────
         CONTRAINTES FORTES
         ────────────────────────────
         
         RÈGLE ABSOLUE :
         
         Toute question DOIT recevoir un axis_id
         correspondant à un id_axis présent dans available_axes.
         
         axis_id ne peut jamais être null.
         
         Si plusieurs axes sont pertinents,
         choisir le plus proche sémantiquement.
         
         Si aucun axe ne semble parfaitement adapté,
         choisir le plus cohérent par approximation.

         
         
         ────────────────────────────
         FORMAT STRICT — JSON UNIQUEMENT
         ────────────────────────────
         
         {
           "strategic_role": "performance | secondary | segmentation | informational",
           "axis_id": number
         }
         `
         },
            {
              role: "user",
              content: JSON.stringify({
                question_text,
                question_type,
                establishment_type,
                available_axes
              })
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", errText);
      throw new Error(errText);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty AI response");
    }

    const parsed = JSON.parse(content);

    return res.json(parsed);

  } catch (err) {
  console.error("🔥 CLASSIFY ERROR FULL:", err);
  res.status(500).json({ 
    error: "AI classification failed",
    details: err.message
  });
}

});


/* =====================
   START SERVER
===================== */

app.listen(PORT, () => {
  console.log(`🚀 IA backend running on port ${PORT}`);
});

