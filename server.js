import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// route de test simple
app.get("/", (req, res) => {
  res.send("Map IA backend is running 🚀");
});

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
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // ✅ BON MODÈLE
        messages: [
          {
            role: "system",
            content:
              "Tu es un moteur de cartographie conceptuelle. Tu réponds uniquement avec un JSON strict, sans texte autour.",
          },
          {
            role: "user",
            content: `
Concept : "${query}"
Nombre de points : ${limit}

Retourne STRICTEMENT ce format JSON :
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

    console.log("OPENAI RAW RESPONSE:", JSON.stringify(data, null, 2));

    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.log("❌ No content from OpenAI");
      return res.json([]);
    }

    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json([]);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("IA backend running on port", PORT);
});
