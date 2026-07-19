import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    console.log("gemini-2.5-flash works");
  } catch(e) { console.error("2.5-flash fail"); }
  try {
    await ai.models.generateContent({ model: "gemini-pro-latest", contents: "hi" });
    console.log("gemini-pro-latest works");
  } catch(e) { console.error("pro-latest fail"); }
}
run();
