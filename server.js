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
          temperature: 0.15,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: `
Tu es un moteur de cartographie EXPERTE, destiné à un public exigeant.

TA MISSION :
Fournir des lieux et pratiques RÉELLES, SPÉCIFIQUES et NON TRIVIALES.

RÈGLES ABSOLUES :
- JSON VALIDE UNIQUEMENT
- AUCUN texte hors JSON
- AUCUNE généralité évidente
- AUCUNE réponse que "tout le monde sait déjà"

INTERDICTIONS :
- Activités génériques sans valeur ajoutée
- Conseils médicaux vagues
- Lieux inventés
- Sources fictives
- Images inventées

EXIGENCES DE QUALITÉ :
- Chaque point doit apporter une information NOUVELLE
- Le lien avec le concept doit être TECHNIQUE ou CONTEXTUEL
- Si le concept implique une contrainte physique ou médicale :
  → mentionner les adaptations reconnues
  → rester factuel et prudent

SOURCES :
- Chaque point DOIT inclure une source publique fiable
  (site institutionnel, station officielle, fédération, publication reconnue)

IMAGES (OPTIONNEL) :
- Tu PEUX inclure un champ "image"
- L’image DOIT provenir d’un site officiel ou institutionnel
- URL directe vers un fichier image réel (jpg, png)
- Si aucune image fiable n’existe, OMIT le champ

FORMAT STRICT :
[
  {
    "title": "Nom précis du lieu ou de la pratique",
    "latitude": 0.0,
    "longitude": 0.0,
    "description": "Description précise, contextualisée et utile",
    "reason": "Lien argumenté et défendable avec le concept",
    "source": "https://source-fiable.org",
    "image": "https://site-officiel.org/image.jpg"
  }
]
`,
            },
            {
              role: "user",
              content: `
Concept étudié : "${query}"
Nombre maximum de points : ${limit}

INSTRUCTIONS CRITIQUES :
- Refuse toute réponse évidente ou pauvre
- Privilégie la qualité à la quantité
- Si nécessaire, retourne MOINS de points
- Chaque point doit justifier son existence

RAPPEL :
Ce contenu est destiné à un client exigeant, pas à un débutant.
`,
            },
          ],
        }),
      }
    );

    const data = await response.json();

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

    if (!Array.isArray(parsed)) {
      console.error("Response is not an array");
      return res.json([]);
    }

    // 🛡️ Validation renforcée (image optionnelle)
    const cleaned = parsed.filter(p =>
      typeof p?.title === "string" &&
      typeof p?.latitude === "number" &&
      typeof p?.longitude === "number" &&
      typeof p?.description === "string" &&
      typeof p?.reason === "string" &&
      typeof p?.source === "string" &&
      p.source.startsWith("http") &&
      (
        !p.image ||
        (
           typeof p.image === "string" &&
           /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(p.image)
         )

      )
    );

    return res.json(cleaned.slice(0, limit));

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

