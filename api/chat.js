import { GoogleGenAI } from "@google/genai";

let ai = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
  
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
  } catch (e) {
    console.error(e);
    if (e.message && (e.message.includes('429') || e.message.includes('Quota'))) {
      res.json({ text: "عذراً، هناك ضغط كبير على الذكاء الاصطناعي حالياً. يرجى المحاولة بعد قليل." });
    } else {
      res.json({ text: "عذراً، لم أتمكن من معالجة طلبك حالياً." });
    }
  }
}
