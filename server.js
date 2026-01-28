import express from "express";
import fetch from "node-fetch";

const app = express();

/* =====================
   CORS (OBLIGATOIRE)
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
          model: "gpt-4o-mini", // ✅ BON MODÈLE
          messages: [
            {
              role: "system",
              content:
                "Tu es un moteur de cartographie conceptuelle. Tu réponds uniquement en JSON valide, sans texte autour.",
            },
            {
              role: "user",
              content: `
Concept : "${query}"
Nombre de points : ${limit}

Retourne UNIQUEMENT un tableau JSON valide :
[
  {
    "title": "Nom",
    "latitude": 0,
    "longitude": 0,
    "description": "...",
    "reason": "..."
  }
]
`,
            },
          ],
          temperature: 0.3,
        }),
      }
    );

    const data = await response.json();

    // 🔎 Log utile en cas de souci
    console.log("OpenAI raw response:", JSON.stringify(data, null, 2));

    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.log("No content from OpenAI");
      return res.json([]);
    }

    // Sécurité : on tente un parse JSON propre
    try {
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (e) {
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
