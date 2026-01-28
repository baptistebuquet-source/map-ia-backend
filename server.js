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
   ROUTE TEST
===================== */
app.get("/", (req, res) => {
  res.send("API map-ia-backend OK");
});

/* =====================
   ROUTE SEARCH
===================== */
app.post("/search", async (req, res) => {
  const { query, limit = 5 } = req.body;

  if (!query) {
    return res.json([]);
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
          model: "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `
Tu es un moteur de cartographie conceptuelle.

RÈGLES ABSOLUES :
- Tu réponds UNIQUEMENT avec du JSON valide
- AUCUN texte hors du JSON
- AUCUNE balise
- AUCUNE explication

Chaque point DOIT :
- correspondre à un LIEU RÉEL
- avoir des coordonnées GPS RÉALISTES
- être historiquement ou culturellement cohérent

Les coordonnées doivent être plausibles (Europe, monde réel).
`,
            },
            {
              role: "user",
              content: `
Concept : "${query}"
Nombre de points : ${limit}

Retourne STRICTEMENT un tableau JSON :

[
  {
    "title": "Nom du lieu ou concept",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "description": "Description courte et claire",
    "reason": "Pourquoi ce lieu est lié au concept"
  }
]

IMPORTANT :
- Utilise de vrais lieux (villes, sites, régions)
- Répartis les points géographiquement si pertinent
- N'invente pas de coordonnées absurdes
`,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    // 🔎 Log complet pour debug
    console.log("OpenAI raw response:", JSON.stringify(data, null, 2));

    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.log("No content from OpenAI");
      return res.json([]);
    }

    try {
      const parsed = JSON.parse(text);

      // Sécurité minimale
      if (!Array.isArray(parsed)) {
        console.error("Response is not an array");
        return res.json([]);
      }

      return res.json(parsed);
    } catch (err) {
      console.error("JSON parse error:", text);
      return res.json([]);
    }
  } catch (err) {
    console.error("OpenAI request error:", err);
    res.json([]);
  }
});

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("IA backend running on port", PORT);
});

