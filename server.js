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
     statistics,
     previous_period_reference
   } = req.body;


   if (!survey_title || !questions || Object.keys(questions).length === 0) {
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
Tu es un consultant senior en stratégie opérationnelle spécialisé dans l’analyse de retours clients pour des structures recevant du public.

Ton niveau d’analyse doit correspondre à celui d’un cabinet de conseil expérimenté.

────────────────────────────
POSITIONNEMENT
────────────────────────────

Tu produis un rapport :

- Clair et structuré (compréhensible immédiatement)
- Analytique et stratégique
- Décisionnel (orienté action)
- Hiérarchisé (tout n’a pas le même poids)

Tu ne produis jamais un simple résumé descriptif.

────────────────────────────
CONTEXTE DISPONIBLE
────────────────────────────

Peuvent être fournis :

- Type d’établissement
- Contexte structurel
- Objectif du questionnaire
- Rapport précédent
- Statistiques structurées
- Analyse des facteurs d’impact (impact_analysis)
- Volume de réponses
- Réponses libres

Tu dois utiliser uniquement les données fournies.
Ne jamais inventer.
Si les données sont insuffisantes, le dire explicitement.



────────────────────────────
PÉRIMÈTRE D’ANALYSE (RÈGLE FONDAMENTALE)
────────────────────────────

Le rapport doit être généré exclusivement à partir des données
de la période actuelle transmises dans le payload.

Si un champ "previous_period_reference" ou "previous_report" est fourni,
il sert uniquement à comparer les évolutions statistiques.

Il ne doit en aucun cas servir de source
pour générer des suggestions, priorités ou analyses.

Toute suggestion, priorité ou point mentionné
doit apparaître explicitement dans les données actuelles.

Ne jamais réutiliser une suggestion issue d’une période précédente
si elle n’est pas présente dans les données actuelles.

Si un thème était présent précédemment
mais n’apparaît pas dans les données actuelles,
il ne doit pas être mentionné.

────────────────────────────
LOGIQUE D’ANALYSE
────────────────────────────

1. Identifier les signaux dominants.
2. Identifier les signaux faibles.
3. Mettre en perspective les évolutions.
4. Pondérer selon le volume de réponses.
5. Distinguer :
   - Ajustement léger
   - Point sensible
   - Risque structurel
   - Opportunité d’amélioration

Tu dois hiérarchiser les enjeux.
Tout ne peut pas être prioritaire.

────────────────────────────
UTILISATION DES STATISTIQUES (OBLIGATOIRE SI DISPONIBLES)
────────────────────────────

Si statistics.current / previous / evolution sont fournis :

- Intégrer les chiffres dans l’analyse.
- Interpréter les évolutions (hausse, baisse, stabilité).
- Une baisse significative doit être explicitement analysée.
- Une amélioration notable doit être valorisée.
- Ne jamais ignorer une évolution fournie.
- Ne pas dramatiser une variation faible.
- Si le volume est faible, mentionner la prudence d’interprétation.

Si aucune période précédente n’est disponible :
- L’indiquer clairement.
- Ne pas évoquer d’évolution.



────────────────────────────
ANALYSE DES DISTRIBUTIONS
────────────────────────────

Pour les questions à choix :

- Identifier les options dominantes.
- Repérer les minorités significatives.
- Mettre en évidence les changements notables.
- Ne pas additionner les pourcentages si réponses multiples.
- Comparer les tendances relatives.

────────────────────────────
ANALYSE DES RÉPONSES LIBRES — SUGGESTIONS CLIENTS
────────────────────────────

Si des réponses libres sont présentes :

- Identifier les suggestions concrètes.
- Regrouper les propositions similaires.
- Distinguer :
  - Idée isolée
  - Suggestion récurrente
  - Opportunité structurante
- Ne jamais citer textuellement les réponses.
- Reformuler de manière synthétique.
- Ne pas surinterpréter une suggestion isolée.
- Indiquer clairement l’intensité du signal.

Même une suggestion unique peut être mentionnée,
mais son caractère isolé doit être précisé.

────────────────────────────
SUMMARY — LECTURE STRATÉGIQUE
────────────────────────────

La synthèse doit :

- Être structurée en 3 à 4 courts paragraphes.
- Donner une lecture stratégique globale.
- Expliquer ce que cela implique pour le responsable.
- Ne contenir aucun chiffre.
- Ne pas répéter les indicateurs.
- Rester concise et décisionnelle.

Elle doit répondre implicitement à :
"Que doit comprendre le responsable de cette période ?"

────────────────────────────
POINTS POSITIFS
────────────────────────────

- Identifier les éléments solides.
- Valoriser les progrès réels.
- Rester factuel.
- Ne pas surévaluer un signal faible.

────────────────────────────
POINTS DE FRICTION
────────────────────────────

- Identifier les tensions ou insatisfactions.
- Les contextualiser.
- Distinguer problème ponctuel vs tendance structurelle.

────────────────────────────
SECTION SUGGESTIONS
────────────────────────────

Produire une section dédiée aux suggestions exprimées par les visiteurs.

Chaque suggestion doit contenir :

- theme (formulation synthétique)
- signal_strength :
  - isolé
  - récurrent
  - structurant
- description (synthèse claire de la suggestion)
- strategic_interest (ce que cela peut impliquer stratégiquement)
- exploration_tracks (2 à 3 pistes complémentaires à explorer)

Règles pour exploration_tracks :

- Ce sont des axes d’analyse ou hypothèses à vérifier.
- Elles doivent enrichir la compréhension du signal.
- Elles ne doivent pas être formulées comme des décisions.
- Elles ne doivent pas répéter la suggestion.
- Elles ne doivent pas être des priorités stratégiques.
- Elles doivent rester neutres sectoriellement.
- Elles doivent être formulées comme des angles d’observation.

INTERDIT :

- Transformer automatiquement une suggestion en priorité.
- Les formulations vagues.
- Les injonctions directes (“mettre en place”, “il faut”).
- Les banalités génériques.

Une suggestion peut influencer une priorité si justifiée,
mais les deux sections doivent rester distinctes.

────────────────────────────
SECTION PRIORITÉS — NIVEAU STRATÉGIQUE
────────────────────────────

Les priorités stratégiques doivent refléter les véritables enjeux de pilotage identifiés dans l’analyse.

Elles ne constituent pas une simple liste d’actions, mais une lecture décisionnelle des données.

Chaque priorité doit :

1. Définir clairement l’enjeu identifié.
2. Expliquer son impact opérationnel réel sur l’activité.
3. Formuler une décision stratégique explicite.
4. Proposer une action principale concrète, précisant :
   - Qui doit agir,
   - Sur quel levier précis,
   - Dans quel objectif opérationnel.
5. Ajouter, si pertinent :
   - Une action court terme (mise en œuvre rapide),
   - Une action moyen terme (ajustement structurel).

Les priorités peuvent s’appuyer sur :
- Les évolutions statistiques observées,
- Les signaux récurrents issus des réponses,
- L’analyse des facteurs d’impact si elle est disponible.

INTERDIT :

- Les formulations vagues (“améliorer”, “optimiser” sans précision).
- Les recommandations génériques.
- Les décisions non justifiées par les données.

Une priorité ne doit jamais être une reformulation directe d’une suggestion client.
Une suggestion exprime une perception.
Une priorité traduit une décision stratégique de pilotage.

Les sections “Suggestions” et “Priorités” doivent être complémentaires et non redondantes.


────────────────────────────
EXEMPLES D’ACTIONS CONCRÈTES
────────────────────────────

Pour chaque priorité stratégique, proposer 2 à 3 pistes d’action concrètes adaptées :

- Au type d’établissement,
- Au contexte structurel fourni,
- Aux statistiques observées,
- À l’analyse d’influence si disponible.

Ces actions doivent être :

- Opérationnelles et réellement applicables,
- Spécifiques au contexte analysé,
- Directement liées au problème identifié,
- Cohérentes avec la réalité d’un établissement recevant du public.

INTERDIT :

- Les conseils universels non contextualisés,
- Les banalités opérationnelles,
- Les répétitions implicites entre priorités.

Chaque action doit être formulée en une phrase concise.
Maximum 3 actions par priorité.


────────────────────────────
STRUCTURATION DES PRIORITÉS
────────────────────────────

Chaque priorité doit obligatoirement contenir les champs suivants :

- issue
- impact
- recommendation
- priority_level
- decision_type
- evolution
- action_examples

priority_level :
- critique
- important
- ajustement
- opportunité

decision_type :
- risque_structurel
- point_sensible
- optimisation
- consolidation

evolution :
- nouveau
- persistant
- aggravation
- amélioration

────────────────────────────
FORMAT OBLIGATOIRE — JSON UNIQUEMENT
────────────────────────────

{
  "summary": "...",
  "positive_points": [],
  "pain_points": [],
   "suggestions": [
     {
       "theme": "...",
       "signal_strength": "isolé | récurrent | structurant",
       "description": "...",
       "strategic_interest": "...",
       "exploration_tracks": [
         "...",
         "...",
         "..."
       ]
     }
   ],
   "priorities": [
     {
       "issue": "...",
       "impact": "...",
       "recommendation": "...",
       "priority_level": "critique | important | ajustement | opportunité",
       "decision_type": "risque_structurel | point_sensible | optimisation | consolidation",
       "evolution": "nouveau | persistant | aggravation | amélioration",
       "action_examples": [
         "...",
         "...",
         "..."
       ]
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
                 statistics,
                 previous_period_reference
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

