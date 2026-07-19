import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: "Hello"
    });
    console.log(res.text);
  } catch (e) {
    console.error(e);
  }
}
test();
