
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getMissionControlCommentary(score: number, status: 'playing' | 'gameover'): Promise<string> {
  const prompt = status === 'playing' 
    ? `The player's rocket is currently in deep space. Current score: ${score}. 
       Give a very short (max 10 words) encouraging or tactical mission control message. 
       Use space jargon. No hashtags.`
    : `The player's rocket just crashed into an asteroid. Final score: ${score}. 
       Give a very short (max 12 words) humorous or professional "mission failed" message from mission control. 
       No hashtags.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });

    return response.text?.trim() || (status === 'playing' ? "Stay focused, pilot!" : "Mission terminated.");
  } catch (error) {
    console.error("Gemini Error:", error);
    return status === 'playing' ? "Clear path ahead!" : "Better luck next flight.";
  }
}
