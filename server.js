import express from "express";
import fetch from "node-fetch";

const app = express();

/* =====================
   CORS
===================== */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS, GET");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

/* =====================
   TEST ROUTE
===================== */
app.get("/", (req, res) => {
  res.send("API map-ia-backend OK");
});

/* =====================
   ROUTE : CATÉGORISATION SONDAGE
===================== */
app.post("/categorize", async (req, res) => {
  const { question, answers, categories } = req.body;

  if (!question || !Array.isArray(answers) || !categories?.length) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.35,
          messages: [
            {
              role: "system",
              content:
                "Tu es un système de classification. Tu réponds UNIQUEMENT en JSON valide.",
            },
            {
              role: "user",
              content: `
Tu dois classifier un sondage.

Question :
"${question}"

Propositions :
${answers.map(a => `- ${a}`).join("\n")}

Catégories disponibles :
${categories.join(", ")}

PROCÉDURE OBLIGATOIRE (SUIVRE DANS TA TÊTE) :
1. Analyse le thème principal du sondage
2. Évalue CHAQUE catégorie disponible sur une échelle de 0 à 100
3. Sélectionne les catégories les PLUS pertinentes (score élevé)
4. Retourne ENTRE 2 ET 3 catégories si possible
5. N'utilise "Société" QUE si aucune autre catégorie n'est plus précise

RÈGLES STRICTES DE SORTIE :
- Réponds UNIQUEMENT avec un tableau JSON valide
- 2 à 3 catégories OBLIGATOIRES (1 SEULEMENT si vraiment impossible)
- Aucune explication
- Aucun texte autour

Exemple de sortie attendue :
["Technologie","IA","Éthique"]

Réponse :
`,
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.error("OpenAI empty response", data);
      return res.json({ categories: ["Société"] });
    }

    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid AI categories");
    }

    res.json({ categories: parsed });

  } catch (err) {
    console.error("Categorize error:", err);
    res.json({ categories: ["Société"] }); // fallback SAFE
  }
});

/* =====================
   SEARCH ROUTE (TON ANCIENNE)
===================== */
app.post("/search", async (req, res) => {
  const { query, limit = 5 } = req.body;
  if (!query) return res.json([]);

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "Tu es un moteur de cartographie conceptuelle. Tu réponds UNIQUEMENT en JSON valide.",
            },
            {
              role: "user",
              content: `
Concept : "${query}"
Nombre de points : ${limit}

Retourne UNIQUEMENT un tableau JSON valide :

[
  {
    "title": "Titre court",
    "place_name": "Nom du lieu réel",
    "address": "Adresse lisible",
    "description": "Description courte",
    "reason": "Lien avec le concept"
  }
]
`,
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) return res.json([]);

    const parsed = JSON.parse(text);
    res.json(parsed);

  } catch (err) {
    console.error("Search error:", err);
    res.json([]);
  }
});

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("IA backend running on port", PORT);
});
