const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const newRoute = `
  app.post("/api/chat", express.json(), async (req, res) => {
    try {
      const { content } = req.body;
      if (!ai) return res.status(500).json({ error: "AI not initialized" });
      const result = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: content,
        config: {
          systemInstruction: "You are HBOT, a smart and helpful AI assistant for the chat application. You can assist the user with any tasks. If the user asks for images, you can use markdown syntax to provide an image URL from an image generation service like Pollinations (e.g. ![Image](https://image.pollinations.ai/prompt/description%20of%20image?width=512&height=512&nologo=true) ). Communicate primarily in Arabic unless asked otherwise, be concise, and act like a chat partner.",
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
`;

if (!code.includes('/api/chat')) {
    code = code.replace('async function startServer() {', 'async function startServer() {\n' + newRoute);
    fs.writeFileSync('server.ts', code);
}
