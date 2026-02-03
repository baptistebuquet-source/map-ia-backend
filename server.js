import express from "express";
import fetch from "node-fetch";

const app = express();

/* =====================
   CONFIG
===================== */

const PORT = process.env.PORT || 3001;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  console.error("❌ OPENAI_API_KEY manquante");
  process.exit(1);
}

/* =====================
   MIDDLEWARE
===================== */

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

/* =====================
   HEALTH CHECK
===================== */

app.get("/", (_, res) => {
  res.send("✅ IA Categorization API running");
});

/* =====================
   ROUTE : CATEGORIZE
===================== */

app.post("/categorize", async (req, res) => {
  const { question, answers, categories } = req.body;

  console.log("\n==============================");
  console.log("📥 REQUEST RECEIVED");
  console.log("Question:", question);
  console.log("Answers:", answers);
  console.log("Categories:", categories);

  // Validation basique
  if (
    !question ||
    !Array.isArray(answers) ||
    answers.length < 2 ||
    !Array.isArray(categories) ||
    categories.length === 0
  ) {
    console.error("❌ Invalid payload");
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `
Tu es un système STRICT de classification de sondages.

RÈGLES ABSOLUES :
- Choisis ENTRE 1 ET 3 catégories
- N'utilise QUE les catégories fournies
- "Société" est INTERDITE sauf si aucune autre catégorie n'est pertinente
- Réponds UNIQUEMENT en JSON valide

Format de réponse OBLIGATOIRE :
{
  "categories": ["Cat1","Cat2"]
}
`
            },
            {
              role: "user",
              content: JSON.stringify({
                question,
                answers,
                categories
              })
            }
          ]
        }),
      }
    );

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    console.log("\n🤖 RAW AI RESPONSE:");
    console.log(text);

    if (!text) {
      throw new Error("Empty AI response");
    }

    const parsed = JSON.parse(text);

    console.log("\n🧠 PARSED AI RESPONSE:");
    console.log(parsed);

    if (
      !parsed.categories ||
      !Array.isArray(parsed.categories) ||
      parsed.categories.length === 0
    ) {
      throw new Error("Invalid categories format");
    }

    // Nettoyage & sécurisation
    let finalCategories = parsed.categories.filter(c =>
      categories.includes(c)
    );

    // Anti "Société" abusif
    if (finalCategories.length > 1 && finalCategories.includes("Société")) {
      finalCategories = finalCategories.filter(c => c !== "Société");
    }

    if (finalCategories.length === 0) {
      console.warn("⚠️ Fallback intelligent déclenché");
      finalCategories = ["Culture"];
    }

    console.log("\n✅ FINAL CATEGORIES:", finalCategories);
    console.log("==============================\n");

    res.json({ categories: finalCategories });

  } catch (err) {
    console.error("\n🔥 CATEGORIZE ERROR");
    console.error(err);
    console.log("==============================\n");

    res.json({ categories: ["Culture"] });
  }
});

/* =====================
   START SERVER
===================== */

app.listen(PORT, () => {
  console.log(`🚀 IA backend running on port ${PORT}`);
});
