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

// Géocodage STRICT à partir d’une ADRESSE
async function geocodeAddress(address, city, country = "France") {
  const q = `${address}, ${city}, ${country}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;

  const r = await fetch(url, {
    headers: { "User-Agent": "map-ia-backend/1.0" }
  });

  const data = await r.json();
  if (!data || !data[0]) return null;

  const d = data[0];

  // Vérification stricte de la commune
  const cityMatch =
    d.address?.city ||
    d.address?.town ||
    d.address?.village ||
    "";

  if (!cityMatch.toLowerCase().includes(city.toLowerCase())) {
    return null;
  }

  return {
    latitude: parseFloat(d.lat),
    longitude: parseFloat(d.lon),
    displayName: d.display_name
  };
}

// Extraction naïve de la ville (à améliorer plus tard si besoin)
function extractCity(query) {
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
          temperature: 0,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: `
Tu es un moteur d’IDENTIFICATION DE LIEUX RÉELS.

RÈGLE ABSOLUE :
Tu n’inventes JAMAIS de lieu, de nom, d’adresse ou de coordonnées.

Si un lieu n’a PAS :
- un NOM officiel
- une ADRESSE POSTALE précise
- une SOURCE PUBLIQUE vérifiable
→ TU NE LE RETOURNES PAS.

GÉOGRAPHIE :
- Tous les lieux doivent être STRICTEMENT dans la commune demandée
- Aucun lieu hors ville
- Aucune approximation

INTERDICTIONS :
- Lieux génériques
- Synthèses abstraites
- Regroupements imaginaires

FORMAT STRICT (JSON UNIQUEMENT) :

[
  {
    "title": "Nom officiel exact",
    "address": "Adresse postale complète",
    "city": "Nom exact de la commune",
    "country": "France",
    "description": "Description factuelle",
    "reason": "Pourquoi ce lieu répond précisément à la demande",
    "source": "https://source-officielle.fr",
    "phone": "+33123456789",
    "image": "https://site-officiel.fr/image.jpg"
  }
]
`
            },
            {
              role: "user",
              content: `
REQUÊTE : "${query}"
VILLE CIBLE : "${city}"

CONTRAINTES :
- Refuser tout lieu hors de "${city}"
- Refuser tout lieu sans adresse exacte
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

      // Géocodage STRICT par adresse
      const geo = await geocodeAddress(
        p.address,
        p.city,
        p.country || "France"
      );

      if (!geo) continue;

      results.push({
        title: p.title,
        latitude: geo.latitude,
        longitude: geo.longitude,
        description: p.description,
        reason: p.reason,
        source: p.source,
        phone:
          typeof p.phone === "string" && p.phone.length > 5
            ? p.phone
            : undefined,
        image:
          typeof p.image === "string" &&
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

