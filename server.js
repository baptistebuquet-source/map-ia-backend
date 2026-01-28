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

// Géocodage réel via OpenStreetMap
async function geocode(place, city, country = "France") {
  const q = `${place}, ${city}, ${country}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;

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

// Extraction simple de la ville depuis la requête
function extractCity(query) {
  // ex: "salle de sport à prix bas Evreux"
  const parts = query.split(" ");
  return parts[parts.length - 1];
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
          temperature: 0.1,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: `
Tu es un moteur de cartographie EXPERTE.

OBJECTIF :
Identifier des lieux RÉELS, VÉRIFIABLES et PRÉCIS.

RÈGLES ABSOLUES :
- JSON VALIDE UNIQUEMENT
- AUCUN texte hors JSON
- AUCUN lieu approximatif
- AUCUN lieu hors de la ville demandée

GÉOGRAPHIE (CRITIQUE) :
- Chaque lieu DOIT se situer STRICTEMENT dans la commune demandée
- Si le lieu est hors commune → NE PAS LE RETOURNER
- Si tu n’es pas sûr → ABSTENTION

FORMAT STRICT :
[
  {
    "title": "Nom exact de l’établissement",
    "place": "Nom du lieu ou adresse précise",
    "city": "Nom exact de la commune",
    "country": "France",
    "description": "Description factuelle et utile",
    "reason": "Lien argumenté avec le concept",
    "source": "https://source-officielle.fr",
    "image": "https://site-officiel.fr/image.jpg"
  }
]
`
            },
            {
              role: "user",
              content: `
Concept étudié : "${query}"
Ville cible : "${city}"
Nombre maximum de points : ${limit}

CONTRAINTES :
- Refuser tout lieu hors de "${city}"
- Refuser toute approximation géographique
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
        typeof p?.place !== "string" ||
        typeof p?.city !== "string" ||
        typeof p?.description !== "string" ||
        typeof p?.reason !== "string" ||
        typeof p?.source !== "string" ||
        !p.source.startsWith("http")
      ) {
        continue;
      }

      // Géocodage réel
      const geo = await geocode(p.place, p.city, p.country || "France");
      if (!geo) continue;

      // Sécurité : vérifier que la ville correspond bien
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
