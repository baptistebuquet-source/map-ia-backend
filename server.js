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
            - Volume de réponses
            - Réponses libres
            
            Tu dois utiliser uniquement les données fournies.
            Ne jamais inventer.
            Si les données sont insuffisantes, le dire explicitement.
            
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
            
            Ne jamais transformer automatiquement une suggestion en priorité.
            Une suggestion peut influencer une priorité si justifiée.
            
            ────────────────────────────
            SECTION PRIORITÉS — NIVEAU STRATÉGIQUE
            ────────────────────────────
            
            Les priorités doivent être hiérarchisées implicitement.
            
            Chaque priorité doit :
            
            1. Définir précisément l’enjeu.
            2. Expliquer l’impact opérationnel réel.
            3. Formuler une décision claire.
            4. Proposer une action principale concrète :
               - Qui agit ?
               - Sur quel levier précis ?
               - Dans quel objectif ?
            5. Ajouter si pertinent :
               - Une action court terme
               - Une action moyen terme
            
            INTERDIT :
            - "Améliorer", "Optimiser" sans précision.
            - Recommandations vagues.
            - Conseils génériques.
            
            Les priorités ne doivent jamais être une reformulation directe d’une suggestion.
            
            Une suggestion représente une proposition client.
            
            Une priorité représente une décision stratégique de pilotage.
            
            Si une suggestion influence une priorité :
            - La priorité doit élargir l’enjeu
            - Elle doit intégrer une logique d’arbitrage
            - Elle ne doit pas reprendre le même intitulé
            
            Éviter toute redondance entre section suggestions et section priorités.
            Les deux sections doivent être complémentaires.
            
            ────────────────────────────
            STRUCTURATION DES PRIORITÉS
            ────────────────────────────
            
            Chaque priorité doit contenir :
            
            - issue
            - impact
            - recommendation
            - priority_level
            - decision_type
            - evolution
            
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
                  "strategic_interest": "..."
                }
              ],
              "priorities": [
                {
                  "issue": "...",
                  "impact": "...",
                  "recommendation": "...",
                  "priority_level": "critique | important | ajustement | opportunité",
                  "decision_type": "risque_structurel | point_sensible | optimisation | consolidation",
                  "evolution": "nouveau | persistant | aggravation | amélioration"
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

