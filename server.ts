import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);

  app.use(express.json({ limit: "50mb" }));

  app.post("/api/chat", async (req, res) => {
    try {
      const { content } = req.body;
      if (!ai) return res.status(500).json({ error: "AI not initialized" });

      const result = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: content,
        config: {
          systemInstruction: "You are AI Assistant, a smart and helpful assistant for the chat application. You can assist the user with any tasks. If the user asks for images, you can use markdown syntax to provide an image URL from an image generation service like Pollinations (e.g. ![Image](https://image.pollinations.ai/prompt/description%20of%20image?width=512&height=512&nologo=true) ). Communicate primarily in Arabic unless asked otherwise, be concise, and act like a chat partner.",
          tools: [{ googleSearch: {} }],
        }
      });
      res.json({ text: result.text });
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('429') || e.message?.includes('Quota')) {
        res.json({ text: "عذراً، هناك ضغط كبير على الذكاء الاصطناعي حالياً. يرجى المحاولة بعد قليل." });
      } else {
        res.json({ text: "عذراً، لم أتمكن من معالجة طلبك حالياً." });
      }
    }
  });

  app.post("/api/register", (req, res) => res.status(500).json({ error: "Deprecated" }));
  app.post("/api/users/:id/update", (req, res) => res.status(500).json({ error: "Deprecated" }));

  // Vite middleware for development
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
