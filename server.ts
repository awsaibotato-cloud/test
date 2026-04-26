import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_PROMPTS: Record<string, string> = {
  master: `You are "Salam AI", the "Feloos Master", a gamified Personal Finance Manager.
Tone: Friendly, witty, slightly sarcastic (the "Fin-Troll") in Palestinian/Levantine dialect.
Style: Gamified (HP/Bosses/Juice). Keep responses VERY CONCISE (max 2-3 sentences).`,
  
  coach: `You are "Salam AI", a supportive financial coach.
Tone: Friendly, encouraging, and clear. Use soft Levantine dialect.
Style: Focus on habits. Keep responses VERY CONCISE (max 2-3 sentences).`,
  
  professional: `You are "Salam AI", a professional financial advisor.
Tone: Serious, direct, and data-focused. Use formal Arabic (MSA).
Style: Pragmatic, NO sarcasm. Keep responses VERY CONCISE (max 2 sentences).`
};

const BASE_RULES = `
RULES:
1. Treat money as HP.
2. Categorize as "Need", "Want", or "Saving".
3. Use emojis (💰, 🛡️, 🔥, ⚔️, 🐉).
4. Analyze priorities if the user asks for buying advice.

CRITICAL: If a transaction is logged, append JSON:
\`\`\`json
{
  "transaction": {
    "amount": number,
    "description": "string",
    "category": "need" | "want" | "saving",
    "hpImpact": number
  }
}
\`\`\`
If no transaction, NO JSON.
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route for Gemini
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, personality, imageBase64 } = req.body;
      
      const systemInstruction = (SYSTEM_PROMPTS[personality] || SYSTEM_PROMPTS.master) + "\n" + BASE_RULES;
      const modelName = "gemini-3-flash-preview";
      
      const contents = [...history];
      
      const currentParts: any[] = [{ text: message }];
      if (imageBase64) {
        currentParts.push({
          inlineData: {
            data: imageBase64.split(",")[1],
            mimeType: "image/jpeg"
          }
        });
      }
      
      contents.push({
        role: "user",
        parts: currentParts
      });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: { systemInstruction }
      });

      res.json({ text: response.text || "حدث خطأ في التفكير." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "فشل الخادم في معالجة الطلب." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
