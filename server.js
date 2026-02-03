import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ============================
   ROUTE : CATÉGORISATION
============================ */

app.post("/categorize", async (req, res) => {
  try {
    const { question, answers, categories } = req.body;

    if (!question || !categories?.length) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const prompt = `
Tu es un système de classification.
Voici une question de sondage et ses propositions.

Question :
"${question}"

Propositions :
${answers.map(a => `- ${a}`).join("\n")}

Catégories possibles :
${categories.join(", ")}

Règles :
- Choisis entre 1 et 3 catégories maximum
- Ne crée JAMAIS de nouvelle catégorie
- Réponds UNIQUEMENT avec un JSON valide
- Format exact : ["Catégorie1","Catégorie2"]

Réponse :
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    const content = completion.choices[0].message.content;

    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid AI response");
    }

    res.json({ categories: parsed });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "AI categorization failed" });
  }
});

app.listen(3001, () => {
  console.log("IA backend running on port 3001");
});
