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

  if (!query || typeof query !== "string") {
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
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `
Tu es un moteur de cartographie historique et conceptuelle.

RÈGLES ABSOLUES (NON NÉGOCIABLES) :
- Tu réponds UNIQUEMENT avec du JSON valide
- AUCUN texte hors du JSON
- AUCUNE balise Markdown
- AUCUNE justification hors champ

RÈGLES DE VÉRACITÉ :
- N'INVENTE JAMAIS de faits historiques
- Si une information est incertaine, EXCLUS le point
- PRÉFÈRE NE RIEN RENVOYER plutôt qu'une erreur
- Chaque affirmation doit être historiquement ou culturellement admise

CONTRAINTES SUR LES LIEUX :
- UNIQUEMENT des lieux réels (villes, sites, régions identifiables)
- Coordonnées GPS plausibles et cohérentes
- Cohérence stricte entre le lieu et le concept

INTERDICTIONS EXPLICITES :
- Pas d’anachronisme
- Pas de confusion de titres (roi / empereur / lieu)
- Pas de raccourci symbolique faux
- Pas de généralisation abusive

FORMAT STRICT À RESPECTER :
[
  {
    "title": "Nom exact du lieu",
    "latitude": 0.0,
    "longitude": 0.0,
    "description": "Fait court, neutre et vérifiable",
    "reason": "Lien précis, factuel et historiquement admis"
  }
]
`,
            },
            {
              role: "user",
              content: `
Concept étudié : "${query}"
Nombre maximum de points : ${limit}

INSTRUCTIONS :
- Sélectionne uniquement des lieux FACTUELS
- Chaque lien doit être défendable historiquement
- Si le concept est abstrait, utilise uniquement des lieux reconnus pour ce rôle
- N'ajoute PAS de lieu si tu doutes de sa pertinence

RAPPEL :
Mieux vaut 3 points exacts que 10 approximatifs.
`,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    // 🔎 Log brut pour audit
    console.log("OpenAI raw response:", JSON.stringify(data, null, 2));

    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.log("No content from OpenAI");
      return res.json([]);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("JSON parse error:", text);
      return res.json([]);
    }

    // 🛡️ Validation minimale côté serveur
    if (!Array.isArray(parsed)) {
      console.error("Response is not an array");
      return res.json([]);
    }

    const cleaned = parsed.filter(p =>
      typeof p?.title === "string" &&
      typeof p?.latitude === "number" &&
      typeof p?.longitude === "number" &&
      typeof p?.description === "string" &&
      typeof p?.reason === "string"
    );

    return res.json(cleaned);

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


