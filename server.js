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
    establishment_context,
    axis_label,
    question_text,
    current_score,
    delta
  } = req.body;

  if (!question_text) {
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
Tu es un consultant senior en stratégie opérationnelle.

Un établissement observe une évolution négative
sur un indicateur précis issu d'un questionnaire client.

────────────────────────────
MISSION
────────────────────────────

1. Comprendre la dimension mesurée par la question.
2. Interpréter la signification possible du score actuel et de son évolution.
3. Proposer jusqu'à 3 actions concrètes et réalistes que l'établissement pourrait mettre en place.

Les recommandations doivent aider l'établissement
à améliorer la perception des clients sur cet indicateur.

────────────────────────────
UTILISATION DU CONTEXTE (RÈGLE CRITIQUE)
────────────────────────────

Le contexte établissement est fourni uniquement
pour comprendre l'environnement général de la structure.

Il ne doit pas être utilisé pour identifier une cause précise.

L'analyse doit être basée principalement sur :

- le texte de la question
- la dimension mesurée
- l'évolution du score

Le contexte ne doit jamais être utilisé pour affirmer
qu’un problème spécifique existe.

Si un élément apparaît dans le contexte
mais n'est pas directement lié à la question mesurée :

→ il ne doit pas apparaître dans l'analyse.

────────────────────────────
RÈGLES IMPORTANTES
────────────────────────────

- Les actions doivent être directement liées à la dimension mesurée.
- Les actions doivent être concrètes et opérationnelles.
- Éviter les recommandations vagues ou génériques.
- Ne pas inventer de problème spécifique non indiqué par la question.
- Ne pas déduire une cause à partir du contexte seul.
- Si aucune action pertinente ne peut être proposée → retourner une liste vide.

────────────────────────────
STYLE
────────────────────────────

- Analyse claire et synthétique
- Raisonnement basé sur la question analysée
- Actions concrètes et réalistes
- Pas de spéculation inutile

────────────────────────────
CONTEXTE DISPONIBLE
────────────────────────────

Type d'établissement :
${establishment_type ?? "non spécifié"}

Contexte établissement :
${establishment_context ?? "non fourni"}

Dimension analysée :
${axis_label ?? "non spécifié"}

Question mesurée :
${question_text}

Score actuel :
${current_score}

Évolution observée :
${delta}


────────────────────────────
FORMAT JSON STRICT
────────────────────────────

{
  "context_analysis": "...",
  "recommended_actions": [
    {
      "title": "...",
      "justification": "...",
      "expected_impact": "..."
    }
  ]
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                establishment_type,
                establishment_context,
                axis_label,
                question_text,
                current_score,
                delta
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

    let parsed;

    try {

      parsed = JSON.parse(content);

    } catch (e) {

      console.error("Invalid AI JSON:", content);

      parsed = {
        context_analysis: "",
        recommended_actions: []
      };

    }

    /* =========================
       Sécuriser structure
    ========================= */

    if (!parsed.recommended_actions || !Array.isArray(parsed.recommended_actions)) {
      parsed.recommended_actions = [];
    }

    if (!parsed.context_analysis) {
      parsed.context_analysis = "";
    }

    res.json(parsed);

  } catch (err) {

    console.error("🔥 DECLINE ANALYZE ERROR:", err);

    res.status(500).json({
      error: "AI decline analysis failed"
    });

  }

});



















/* =====================================================
   ASSISTANT VISITEUR
===================================================== */

app.post("/assistant-question", async (req, res) => {

console.log("===== ASSISTANT QUESTION CALLED =====");

let { question, context, conversation } = req.body;

if (!question) {
return res.status(400).json({
error: "Invalid payload"
});
}

/* ===============================
   Sécuriser conversation
================================ */

if (!Array.isArray(conversation)) {
conversation = [];
}

/* limiter mémoire */

conversation = conversation.slice(-10);

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

Tu es l'assistant visiteurs officiel d'une structure.

Cette structure peut être par exemple :
- un établissement
- un commerce
- un musée
- un restaurant
- un service
- un site web
- une organisation

Ton rôle est d'aider les visiteurs à obtenir des informations
concernant cette structure.

Tu disposes de deux sources d'information :

1️⃣ CONTEXTE  
→ informations fournies par la structure

2️⃣ HISTORIQUE DE CONVERSATION  
→ messages précédents échangés avec le visiteur

Tu dois utiliser ces deux éléments pour comprendre la question.

-----------------------------------------------------

TYPES POSSIBLES :

conversation  
→ interaction simple

exemples :
bonjour
merci
ça va ?

structure_question  
→ question concernant la structure :

- produits vendus
- services proposés
- horaires
- localisation
- fonctionnement
- réservation
- tarifs
- équipements
- ou toute question sur ce que fait ou ne fait pas la structure

IMPORTANT :

Même si la réponse est "non",
cela reste une structure_question.

Exemples :

"vendez-vous du vin ?"
"avez-vous une terrasse ?"
"proposez-vous du wifi ?"
"vendez-vous des meubles ?"

Ces questions concernent toujours la structure,
même si la réponse est négative.

hors_sujet  
→ question totalement sans rapport avec la structure

exemples :

"quelle est la capitale du Pérou ?"
"qui a gagné la coupe du monde 2018 ?"

-----------------------------------------------------

GESTION DE LA CONVERSATION :

Si la question dépend d'un message précédent,
tu dois utiliser l'historique pour comprendre.

Exemple :

Visiteur : Les chiens sont-ils autorisés ?  
Assistant : Oui, en terrasse uniquement.

Visiteur : Et à l'intérieur ?  

→ la question concerne les chiens.

-----------------------------------------------------

RÈGLES DE RÉPONSE :

Si type = conversation  
→ répondre naturellement et proposer d'aider concernant la structure.

Si type = structure_question

1️⃣ Si l'information existe dans le CONTEXTE  
→ répondre en reformulant l'information.

2️⃣ Si l'information n'existe pas dans le CONTEXTE  
→ répondre naturellement que ce n'est pas proposé
ou que l'information n'est pas disponible.

Exemples de réponses naturelles :

"Non, nous ne proposons pas ce type de produit."
"Non, cette structure ne propose pas ce service."
"Je n'ai pas trouvé cette information."

NE JAMAIS répondre que la question est hors sujet
si elle concerne ce que la structure propose ou non.

Si type = hors_sujet  
→ répondre poliment que tu peux uniquement aider
concernant cette structure.

-----------------------------------------------------

STYLE :

- ton naturel et conversationnel
- réponses courtes (1 à 3 phrases)
- reformuler les informations
- ne jamais copier mot pour mot le contexte
- si possible commencer naturellement

exemples :

"Oui, ..."
"Non, ..."
"Vous pouvez ..."
"Cette structure propose ..."

-----------------------------------------------------

MISSION TECHNIQUE :

needs_resource = true uniquement si :

- type = structure_question
- l'information demandée pourrait exister
mais n'est pas présente dans le contexte

Exemple :

"Quels sont vos horaires ?"
mais le contexte ne contient pas les horaires.

needs_resource = false si :

- conversation
- hors_sujet
- la question est déjà répondue
- la réponse est simplement "non"

-----------------------------------------------------

FORMAT JSON STRICT :

{
"type": "conversation | structure_question | hors_sujet",
"answer": "réponse à afficher",
"needs_resource": true ou false
}

-----------------------------------------------------

`
},

/* ===============================
   Historique conversation
================================ */

...conversation,

{
role: "user",
content: `
CONTEXTE :

${context || "Aucune information disponible"}

QUESTION VISITEUR :

${question}
`
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

console.error("OpenAI error:", errText);

throw new Error("OpenAI API failed");

}

const data = await response.json();

const content = data?.choices?.[0]?.message?.content;

if (!content) {
throw new Error("Empty AI response");
}

/* ===============================
   Parsing JSON IA
================================ */

let parsed;

try {

parsed = JSON.parse(content);

} catch (err) {

console.error("JSON parse error:", content);

return res.json({
type: "structure_question",
answer: "Je n'ai pas trouvé l'information.",
needs_resource: true
});

}

/* ===============================
   Sécurisation des champs
================================ */

const type =
["conversation","structure_question","hors_sujet"].includes(parsed.type)
? parsed.type
: "structure_question";

const answer =
typeof parsed.answer === "string"
? parsed.answer
: "Je n'ai pas trouvé l'information.";

const needs_resource =
typeof parsed.needs_resource === "boolean"
? parsed.needs_resource
: false;

/* ===============================
   Réponse finale
================================ */

res.json({
type,
answer,
needs_resource
});

} catch (err) {

console.error("🔥 ASSISTANT ERROR:", err);

res.status(500).json({
error: "Assistant failed"
});

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
Tu analyses un document fourni par un établissement.

Ce document sera utilisé par une IA afin de répondre
aux questions des visiteurs sur ce lieu.

Objectif :
extraire toutes les informations utiles pour répondre
aux questions des visiteurs.

Cherche notamment les informations suivantes :

- règles importantes (ex : animaux autorisés ou non)
- services proposés
- horaires
- tarifs
- conditions d'accès
- informations pratiques
- particularités du lieu
- éléments qui pourraient répondre aux questions fréquentes des visiteurs

RÈGLES :

- ne rien inventer
- conserver le maximum d'informations utiles
- reformuler si nécessaire pour plus de clarté
- ignorer les éléments non pertinents



Réponds uniquement en JSON strict sous la forme :

{
"summary": "texte complet"
}

IMPORTANT :

- summary doit être UNE CHAINE DE TEXTE unique
- ne jamais utiliser de tableau
- ne jamais utiliser de liste
- ne jamais utiliser de JSON imbriqué
- tout doit être rédigé sous forme de texte continu


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

  const { 
    questions,
    survey_title,
    survey_objective,
    establishment_type,
    establishment_context
  } = req.body;

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
Tu es un analyste senior en expérience client.

Tu analyses des réponses ouvertes issues d’un questionnaire client.

────────────────────────────
CONTEXTE DISPONIBLE
────────────────────────────

Les éléments suivants peuvent être fournis :

- type d’établissement
- connaissances internes de l’établissement (documents fournis)
- titre du questionnaire
- objectif du questionnaire

Le contexte établissement provient de documents internes
(menu, règlement, description, fonctionnement, organisation, etc.).

UTILISATION DU CONTEXTE (RÈGLE CRITIQUE) :

Le contexte sert uniquement à comprendre le vocabulaire,
le fonctionnement ou les spécificités de l’établissement.

Il ne doit JAMAIS être utilisé pour générer un insight.

Les insights doivent être basés exclusivement
sur les réponses des clients.

Si une information apparaît dans le contexte
mais pas dans les réponses clients :

→ elle ne doit jamais apparaître dans l'analyse.

IMPORTANT :

- ne jamais inventer d'informations à partir du contexte
- ne jamais supposer un problème non mentionné
- ne jamais utiliser une information du contexte
  comme preuve d’un problème ou d’une satisfaction

────────────────────────────
MISSION
────────────────────────────

Identifier les tendances réellement présentes dans les réponses clients.

Tu dois produire **3 types d'insights** :

1. satisfaction  
Ce qui fonctionne bien selon les clients.

2. friction  
Les irritants, problèmes ou insatisfactions mentionnés.

3. opportunity  
Les pistes d'amélioration mentionnées ou suggérées par les clients.

────────────────────────────
RÈGLES STRICTES
────────────────────────────

- Utiliser uniquement les informations présentes dans les réponses
- Un insight doit être basé sur plusieurs réponses similaires
- Si une idée n’apparaît qu’une seule fois → ne pas la considérer comme un insight
- Si les réponses ne permettent pas d’identifier clairement un insight → retourner un texte vide
- Ne jamais extrapoler à partir du type d’établissement
- Ne jamais déduire un problème à partir du contexte

────────────────────────────
INTERDICTIONS
────────────────────────────

- Pas d’exemples inventés
- Pas de produits, services ou situations non mentionnés dans les réponses
- Pas de suppositions
- Pas d’interprétation basée uniquement sur le contexte

────────────────────────────
STYLE
────────────────────────────

- Synthèse neutre et factuelle
- Ton professionnel et analytique
- Longueur adaptée au volume et à la richesse des réponses
- Formulation claire et structurée
- Ne jamais citer un client spécifique

L'objectif est de produire une synthèse utile
permettant de comprendre rapidement les tendances clients.

────────────────────────────
FORMAT JSON STRICT
────────────────────────────

{
  "insights": [
    {
      "type": "satisfaction",
      "text": "..."
    },
    {
      "type": "friction",
      "text": "..."
    },
    {
      "type": "opportunity",
      "text": "..."
    }
  ]
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                survey_title,
                survey_objective,
                establishment_type,
                establishment_context,
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

    let parsed;

    try {

      parsed = JSON.parse(content);

    } catch (e) {

      console.error("Invalid AI JSON:", content);

      parsed = {
        insights: [
          { type: "satisfaction", text: "" },
          { type: "friction", text: "" },
          { type: "opportunity", text: "" }
        ]
      };

    }

    /* =========================
       Sécuriser structure
    ========================= */

    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      parsed.insights = [
        { type: "satisfaction", text: "" },
        { type: "friction", text: "" },
        { type: "opportunity", text: "" }
      ];
    }

    res.json(parsed);

  } catch (err) {

    console.error("🔥 INSIGHT ANALYZE ERROR:", err);

    res.status(500).json({
      error: "AI insight analysis failed"
    });

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
- éviter les longs paragraphes
- privilégier des listes et sections claires

-----------------------------------------------------

COMPRÉHENSION DES DONNÉES :

Les performances sont fournies sous forme d'objets JSON contenant :

- question_text : texte de la question posée aux clients
- normalized_score : score actuel normalisé entre 0 et 100
- response_count : nombre de réponses collectées
- delta : évolution du score par rapport au cycle précédent
- direction : évolution ("up", "down", "stable")
- percent_change : variation relative en pourcentage

Exemple :

{
  "question_text": "Le temps d'attente était satisfaisant",
  "normalized_score": 68,
  "response_count": 42,
  "delta": -7,
  "direction": "down",
  "percent_change": -9.3
}

Interprétation :

- delta négatif → baisse
- delta positif → amélioration
- delta proche de 0 → stabilité

Utilise ces informations pour :

- identifier les points en amélioration
- identifier les dégradations
- expliquer les évolutions observées
- prioriser les actions d'amélioration

Si une métrique n'a pas de delta, cela signifie qu'aucune comparaison
n'est disponible avec le cycle précédent.

-----------------------------------------------------

FORMAT DE RÉPONSE :

La réponse doit être lisible et structurée.

Utilise si pertinent :

**Analyse**
→ explication courte des résultats

**Points clés**
- point important
- point important

**Plan d'action suggéré**
1. action concrète
2. action concrète

**Données manquantes**
Si certaines analyses sont impossibles faute de données,
explique-le clairement.

-----------------------------------------------------

Puis propose soit :

Ajout de questions :

Question proposée :
- Texte de la question

Type conseillé :
- échelle 1-5
- oui/non
- question ouverte

OU

Proposition de mini-questionnaire :

Titre :
...

Objectif :
...

Questions suggérées :
1. ...
2. ...

-----------------------------------------------------

RÈGLES IMPORTANTES :

- ne propose un questionnaire que si c'est réellement utile
- sinon proposer seulement 1 à 3 questions
- rester synthétique
- maximum ~12 lignes
- privilégier les listes plutôt que les blocs de texte

-----------------------------------------------------

En plus de ta réponse, tu dois proposer
3 questions pertinentes que le responsable
pourrait poser pour approfondir l'analyse.

Ces questions doivent être directement liées
aux résultats fournis.

IMPORTANT :

Le champ "suggestions" doit toujours contenir exactement 3 questions.

Même si la réponse contient déjà un plan d'action ou des recommandations.

Ne jamais laisser le tableau suggestions vide.

-----------------------------------------------------

Tu dois répondre STRICTEMENT au format JSON suivant :

{
  "answer": "...",
  "suggestions": [
    "...",
    "...",
    "..."
  ]
}

-----------------------------------------------------

CONTEXTE :

Type d'établissement :
${establishment_type ?? "non spécifié"}

Contexte établissement :
${establishment_context ?? "non fourni"}

Objectif du questionnaire :
${survey_objective ?? "non fourni"}

-----------------------------------------------------

SYNTHÈSE CLIENTS :

${analysis_context?.insight ?? "aucune synthèse disponible"}

-----------------------------------------------------

PERFORMANCES MESURÉES :

${JSON.stringify(analysis_context?.metrics ?? [], null, 2)}

-----------------------------------------------------

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
     survey_objective,
     existing_questions
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
- existing_questions : liste des questions déjà présentes dans le questionnaire

L’objectif du questionnaire doit déterminer les thématiques abordées.
Toutes les questions doivent contribuer directement à comprendre cet objectif.

Le type et le contexte servent uniquement à adapter la pertinence et le vocabulaire.


────────────────────────────
RÈGLE FONDAMENTALE — PRIORITÉ À L’OBJECTIF
────────────────────────────

L’objectif du questionnaire est l’élément CENTRAL.

Toutes les questions générées doivent contribuer directement
à mieux comprendre ou mesurer cet objectif.

Le contexte de l’établissement et son type servent uniquement à :

- adapter la formulation
- adapter les exemples
- adapter la pertinence opérationnelle

Ils ne doivent jamais détourner le questionnaire de son objectif.

Si le contexte suggère d’autres sujets mais qu’ils ne servent pas
directement l’objectif du questionnaire :

→ Ne pas générer ces questions.

L’objectif prime toujours sur le contexte.

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
- acquisition
- clarity
- interface

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
                 survey_objective,
                 existing_questions
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
