import { GoogleGenAI, Modality } from "@google/genai";
import { decode, createWavBlob, changePcmSpeed } from "../utils/audioUtils";

export async function generateSpeechBytes(text: string, voice: string, apiKey?: string, speed: number = 1.0): Promise<Uint8Array> {
  const key = apiKey || process.env.API_KEY;
  if (!key) {
    throw new Error("API key is required. Please set it in Settings.");
  }
  const ai = new GoogleGenAI({ apiKey: key });

  if (!text.trim()) {
    return new Uint8Array(0);
  }

  const model = "gemini-2.5-flash-preview-tts";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Audio) {
    throw new Error("API did not return audio data.");
  }

  const pcmData = decode(base64Audio);
  
  // Post-process for speed adjustment
  if (speed !== 1.0) {
      return await changePcmSpeed(pcmData, speed);
  }
  
  return pcmData;
}


export async function generateSpeech(text: string, voice: string, apiKey?: string, speed: number = 1.0): Promise<string> {
  const audioBytes = await generateSpeechBytes(text, voice, apiKey, speed);
  const wavBlob = createWavBlob(audioBytes);
  const audioUrl = URL.createObjectURL(wavBlob);
  return audioUrl;
}
