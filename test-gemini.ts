import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const res = await ai.models.generateContent({
    model: 'gemini-1.5-pro-latest',
    contents: 'hello'
  });
  console.log("success:", res.text);
}
test().catch(e => console.error(e.message));
