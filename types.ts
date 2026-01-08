
export interface AudioResult {
  id: number;
  text: string;
  audioUrl: string;
}

export interface ApiKey {
  id: number;
  key: string;
}

export type TtsProvider = 'gemini' | 'elevenlabs';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
}

export interface ElevenLabsModel {
  model_id: string;
  name: string;
  description?: string;
}

export interface ElevenLabsSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}
