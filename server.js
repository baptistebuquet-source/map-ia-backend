import express from "express";
import fetch from "node-fetch";

const app = express();

/* =====================
   CORS
===================== */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");

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
   SEARCH ROUTE
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

Retourne UNIQUEMENT un tableau JSON valide, sans texte autour :

[
  {
    "title": "Titre court",
    "place_name": "Nom du lieu réel",
    "address": "Adresse lisible (rue, ville, pays)",
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

    if (!text) {
      console.log("No content from OpenAI", data);
      return res.json([]);
    }

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error("OpenAI error:", err);
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
