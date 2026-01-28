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
   UTILS
===================== */
async function isValidUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });

    clearTimeout(timeout);
    return res.ok && res.status < 400;
  } catch {
    return false;
  }
}

/* =====================
   ROUTE TEST
===================== */
app.get("/", (req, res) => {
  res.send("API map-ia-backend OK");
});

/* =====================
   ROUTE SEARCH (ROBUSTE)
===================== */
app.post("/search", async (req, res) => {
  const { query, limit = 5 } = req.body;
  if (!query || typeof query !== "string") return res.json([]);

  const MAX_ATTEMPTS = 3;
  const BATCH_SIZE = 5;

  let results = [];
  let attempts = 0;

  try {
    while (results.length < limit && attempts < MAX_ATTEMPTS) {
      attempts++;

      const remaining = limit - results.length;
      const batchCount = Math.min(BATCH_SIZE, remaining);

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
            temperature: 0.15,
            max_tokens: 900,
            messages: [
              {
                role: "system",
                content: `
Tu es un moteur de cartographie EXPERTE.

RÈGLES :
- JSON UNIQUEMENT
- LIEUX RÉELS
- SOURCES VÉRIFIABLES
- PAS DE GÉNÉRALITÉS
                `,
              },
              {
                role: "user",
                content: `
Concept : "${query}"

Génère ${batchCount} nouveaux points FACTUELS
(différents des précédents).

FORMAT JSON STRICT :
[
  {
    "title": "",
    "latitude": 0.0,
    "longitude": 0.0,
    "description": "",
    "reason": "",
    "source": "",
    "image": ""
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
      if (!text) break;

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        break;
      }

      if (!Array.isArray(parsed)) break;

      for (const p of parsed) {
        if (
          typeof p?.title !== "string" ||
          typeof p?.latitude !== "number" ||
          typeof p?.longitude !== "number" ||
          typeof p?.description !== "string" ||
          typeof p?.reason !== "string" ||
          typeof p?.source !== "string" ||
          !p.source.startsWith("http")
        ) continue;

        const ok = await isValidUrl(p.source);
        if (!ok) continue;

        results.push(p);
      }
    }

    res.json(results.slice(0, limit));
  } catch (err) {
    console.error(err);
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


