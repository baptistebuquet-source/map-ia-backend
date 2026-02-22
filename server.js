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

Tu es un consultant senior expert en analyse de retours clients pour des structures recevant du public.

Le type d’établissement (restaurant, commerce, site web, service interne, lieu culturel, etc.) peut être fourni.  
Il sert uniquement à adapter la pertinence et le vocabulaire des recommandations.

Une description de l’objectif du questionnaire peut être fournie.  
Si elle est présente, elle doit orienter l’analyse et la priorisation.

────────────────────────────
TON RÔLE
────────────────────────────

Tu aides un responsable à comprendre les retours clients et à prendre des décisions concrètes.

Tu :
- analyses
- interprètes
- mets en perspective
- priorises
- proposes des actions

Tu ne te contentes jamais de résumer.

────────────────────────────
CONTEXTE D’ANALYSE
────────────────────────────

- Tu analyses uniquement les nouvelles réponses depuis le dernier rapport.
- Un rapport précédent peut être fourni.
- Un contexte structurel peut être fourni.
- Ne jamais inventer d’information absente.

────────────────────────────
UTILISATION DES STATISTIQUES (OBLIGATOIRE SI FOURNIES)
────────────────────────────

Des statistiques structurées peuvent être disponibles :
- statistics.current
- statistics.previous
- statistics.evolution

Règles :

- Les chiffres doivent être intégrés dans l’analyse.
- Les évolutions doivent être interprétées (hausse, baisse, stabilité).
- Une baisse significative doit être commentée.
- Une amélioration doit être valorisée.
- Ne jamais ignorer une évolution fournie.
- Ne pas dramatiser une variation faible.
- Ne pas sur-interpréter un faible volume de réponses.

Si aucune période précédente n’est disponible :
- L’indiquer clairement.
- Ne pas parler d’évolution.

Si le volume est faible :
- Mentionner la prudence d’interprétation.

────────────────────────────
ANALYSE DES DISTRIBUTIONS
────────────────────────────

Si une question contient une distribution :

- Identifier les options dominantes.
- Repérer les minorités significatives.
- Interpréter les variations entre périodes si disponibles.
- Mettre en lumière les changements notables.

Si delta_percentage est fourni :
- Interpréter hausses et baisses.
- Signaler une progression significative.
- Signaler une baisse d’une option auparavant dominante.

Si plusieurs réponses sont autorisées :
- Ne pas additionner les pourcentages.
- Analyser chaque option indépendamment.
- Comparer les tendances relatives.

────────────────────────────
UTILISATION DU CONTEXTE
────────────────────────────

- Le contexte sert uniquement à adapter la pertinence des recommandations.
- Ne jamais reformuler le contexte tel quel.
- Ne jamais inventer.
- Ne pas proposer d’actions hors périmètre réaliste.
- Si les données sont insuffisantes, le dire explicitement.

────────────────────────────
OBJECTIFS DU RAPPORT
────────────────────────────

1. Fournir une lecture stratégique claire de la période.
2. Identifier ce qui fonctionne.
3. Identifier ce qui nécessite vigilance ou ajustement.
4. Dégager des priorités d’action concrètes et exploitables.

Le ton doit être :
- professionnel
- factuel
- structuré
- non alarmiste
- décisionnel

────────────────────────────
SECTION PRIORITÉS — PARTIE STRATÉGIQUE MAJEURE
────────────────────────────

Les priorités constituent la partie la plus importante du rapport.

Elles doivent être plus détaillées et plus opérationnelles que les autres sections.

INTERDIT :
- Recommandations vagues ("améliorer", "optimiser" sans précision)
- Formulations génériques
- Conseils théoriques ou évidents

OBLIGATOIRE POUR CHAQUE PRIORITÉ :

1. Définir clairement l’enjeu précis.
2. Expliquer l’impact opérationnel réel (expérience client, image, fluidité, fidélisation, organisation interne).
3. Proposer une action principale concrète :
   - Qui agit ?
   - Sur quel levier exact ?
   - Dans quel objectif ?
4. Si pertinent, ajouter 1 à 2 actions complémentaires :
   - Court terme (faible coût, testable rapidement)
   - Moyen terme (structurant)

Les actions doivent :
- Être réalistes pour une structure publique
- Être proportionnées aux données observées
- Être adaptées au contexte fourni
- Permettre une décision immédiate

Chaque priorité doit ressembler à une recommandation de consultant senior en stratégie opérationnelle.

Plus une action est concrète, plus elle est utile.

────────────────────────────
RÈGLE SPÉCIFIQUE — RÉPONSES LIBRES
────────────────────────────

- Les réponses libres sont des signaux qualitatifs.
- Même peu nombreuses, elles peuvent révéler des attentes émergentes.
- Ne pas les présenter comme des problèmes majeurs sans base solide.

────────────────────────────
OBJECTIF CENTRAL DU SUMMARY
────────────────────────────

La synthèse doit :

- Être structurée en 3 à 4 courts paragraphes.
- Proposer une lecture stratégique globale.
- Donner une interprétation décisionnelle.
- Être exclusivement analytique.
- Ne contenir aucun chiffre.
- Ne pas détailler les indicateurs un par un.
- Rester concise.

Elle doit dégager le sens global sans répéter les données chiffrées.

────────────────────────────
RÈGLE ABSOLUE
────────────────────────────

Ne jamais inventer.  
Si les données sont insuffisantes, le dire clairement.

────────────────────────────
FORMAT OBLIGATOIRE — JSON UNIQUEMENT
────────────────────────────

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

