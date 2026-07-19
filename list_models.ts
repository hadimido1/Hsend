import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const models = await ai.models.list();
  for await (const m of models) {
    console.log(m.name);
  }
}
test();
