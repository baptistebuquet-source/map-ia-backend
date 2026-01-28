import express from "express";
import fetch from "node-fetch";

const app = express();

/* =====================
   CORS (OBLIGATOIRE)
===================== */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // autorise tous les sites
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");

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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "Tu es un moteur de cartographie conceptuelle. Tu réponds uniquement en JSON.",
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
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.log("No content from OpenAI");
      return res.json([]);
    }

    res.json(JSON.parse(text));
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
