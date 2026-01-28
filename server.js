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

// Géocodage par ADRESSE (fiable)
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;

  const r = await fetch(url, {
    headers: {
      "User-Agent": "map-ia-backend/1.0"
    }
  });

  const data = await r.json();
  if (!data || !data[0]) return null;

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}

// Extraction simple de la ville (fallback)
function extractCity(query) {
  const words = query.trim().split(" ");
  return words[words.length - 1];
}

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

  const city = extractCity(query);

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
          temperature: 0.05,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: `
Tu es un moteur d’IDENTIFICATION DE LIEUX RÉELS.

RÈGLE ABSOLUE :
Tu n’inventes JAMAIS un lieu, un nom, une adresse ou un contact.

OBJECTIF :
Identifier des établissements RÉELS, EXISTANTS et LOCALISABLES.

GÉOGRAPHIE (CRITIQUE) :
- Tous les lieux doivent se situer STRICTEMENT dans la ville demandée
- Si tu n’es pas certain → NE PAS RETOURNER le lieu

INTERDICTIONS :
- Lieux génériques
- Noms inventés
- Adresses approximatives
- Synthèses conceptuelles

SOURCES :
- Chaque lieu DOIT avoir une source publique vérifiable

FORMAT STRICT (JSON UNIQUEMENT) :

[
  {
    "title": "Nom officiel exact de l’établissement",
    "address": "Adresse postale complète",
    "city": "Nom exact de la commune",
    "country": "France",
    "phone": "+33...",
    "source": "https://site-officiel.fr",
    "image": "https://site-officiel.fr/image.jpg",
    "description": "Description factuelle",
    "reason": "Pourquoi ce lieu répond à la requête"
  }
]
`
            },
            {
              role: "user",
              content: `
REQUÊTE : "${query}"
VILLE OBLIGATOIRE : "${city}"

CONSIGNES :
- Refuser tout lieu hors de "${city}"
- Refuser toute adresse incomplète
- Refuser tout lieu non vérifiable
- Qualité > quantité
`
            }
          ]
        })
      }
    );

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return res.json([]);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.json([]);
    }

    if (!Array.isArray(parsed)) return res.json([]);

    const results = [];

    for (const p of parsed) {
      if (
        typeof p?.title !== "string" ||
        typeof p?.address !== "string" ||
        typeof p?.city !== "string" ||
        typeof p?.description !== "string" ||
        typeof p?.reason !== "string" ||
        typeof p?.source !== "string" ||
        !p.source.startsWith("http")
      ) {
        continue;
      }

      // Géocodage par adresse
      const geo = await geocodeAddress(`${p.address}, ${p.city}, ${p.country || "France"}`);
      if (!geo) continue;

      // Vérification stricte de la ville
      if (!geo.displayName.toLowerCase().includes(p.city.toLowerCase())) {
        continue;
      }

      results.push({
        title: p.title,
        latitude: geo.latitude,
        longitude: geo.longitude,
        description: p.description,
        reason: p.reason,
        source: p.source,
        phone: typeof p.phone === "string" ? p.phone : undefined,
        image:
          p.image &&
          /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(p.image)
            ? p.image
            : undefined
      });

      if (results.length >= limit) break;
    }

    return res.json(results);

  } catch (err) {
    console.error("Backend error:", err);
    return res.json([]);
  }
});

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("IA backend running on port", PORT);
});

