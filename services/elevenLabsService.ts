
import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsSettings } from "../types";
import { decodeAudioDataToPcm } from "../utils/audioUtils";

const DEFAULT_API_BASE = "https://api.elevenlabs.io/v1";
// Đường dẫn tới file PHP trên host trung gian
const RELAY_URL = "https://gomhuongcanh.vn/ai_studio_code.php"; 

export async function fetchElevenLabsVoices(apiKey: string, baseUrl: string = DEFAULT_API_BASE): Promise<ElevenLabsVoice[]> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");

  // Remove trailing slash if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  const response = await fetch(`${cleanBaseUrl}/voices`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || "Failed to fetch voices");
  }

  const data = await response.json();
  return data.voices.map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    preview_url: v.preview_url
  }));
}

export async function fetchElevenLabsModels(apiKey: string, baseUrl: string = DEFAULT_API_BASE): Promise<ElevenLabsModel[]> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  const response = await fetch(`${cleanBaseUrl}/models`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
     const error = await response.json();
    throw new Error(error.detail?.message || "Failed to fetch models");
  }

  const data = await response.json();
  
  // Filter for models that explicitly support text-to-speech
  const validModels = data.filter((m: any) => m.can_do_text_to_speech === true);

  return validModels.map((m: any) => ({
    model_id: m.model_id,
    name: m.name,
    description: m.description
  }));
}

export interface IpCheckResult {
    ip: string;
    used_proxy: string;
    message?: string;
}

export async function checkProxyIp(proxyKey?: string): Promise<IpCheckResult> {
    try {
        const body = {
            action: 'check_ip',
            proxy_key: proxyKey || ''
        };

        const response = await fetch(RELAY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
             throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        return data as IpCheckResult;
    } catch (e: any) {
        throw new Error(e.message || "Failed to check IP");
    }
}

export async function generateElevenLabsSpeechBytes(
  text: string,
  voiceId: string,
  modelId: string,
  apiKey: string,
  languageCode?: string,
  baseUrl: string = DEFAULT_API_BASE,
  settings?: ElevenLabsSettings,
  speed: number = 1.0,
  proxyKey?: string // New parameter
): Promise<Uint8Array> {
  if (!apiKey) throw new Error("ElevenLabs API Key is required");
  if (!text.trim()) return new Uint8Array(0);

  const voiceSettings = {
    stability: settings?.stability ?? 0.5,
    similarity_boost: settings?.similarityBoost ?? 0.75,
    style: settings?.style ?? 0.0,
    use_speaker_boost: settings?.useSpeakerBoost ?? true
  };

  let response;

  // LOGIC: Nếu có ProxyKey, gọi qua Relay PHP. Nếu không, gọi trực tiếp.
  if (proxyKey) {
      console.log("Generating via Relay with Proxy...");
      // Gọi tới file PHP trên server trung gian
      const body = {
          action: 'generate_speech',
          api_key: apiKey,
          proxy_key: proxyKey,
          text: text,
          voice_id: voiceId,
          model_id: modelId,
          voice_settings: voiceSettings,
          language_code: languageCode
      };

      response = await fetch(RELAY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
      });

  } else {
      // Gọi trực tiếp (Logic cũ)
      const cleanBaseUrl = baseUrl.replace(/\/$/, "");
      const body: any = {
        text,
        model_id: modelId,
        voice_settings: voiceSettings,
      };

      if (languageCode) {
        body.language_code = languageCode;
      }

      response = await fetch(`${cleanBaseUrl}/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });
  }

  // 1. Kiểm tra HTTP Status trước
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to generate speech";
    try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail?.message || errorMessage;
        
        if (errorMessage.includes("selected model can not be used")) {
            errorMessage += " (Hãy thử chọn Model khác như 'Eleven Multilingual v2')";
        }
        
        if (errorMessage.includes("maximum amount of custom voices")) {
            errorMessage = "Lỗi ElevenLabs: Tài khoản đã đạt giới hạn Custom Voices. Vui lòng xóa bớt giọng cũ.";
        }
        
        // Handle PHP Relay errors specifically
        if (proxyKey && errorMessage.includes("Proxy")) {
             errorMessage = `Lỗi Proxy/Relay: ${errorMessage}`;
        }

    } catch(e) {
        errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  // 2. Lấy ArrayBuffer
  const arrayBuffer = await response.arrayBuffer();

  // 3. QUAN TRỌNG: Kiểm tra xem ArrayBuffer này có phải là file Audio thật không hay là JSON báo lỗi
  // Nhiều khi Proxy/PHP trả về HTTP 200 nhưng nội dung lại là text báo lỗi.
  try {
      // Decode 1000 bytes đầu tiên để kiểm tra text
      const textDecoder = new TextDecoder();
      const firstBytes = arrayBuffer.slice(0, 1000);
      const textStart = textDecoder.decode(firstBytes).trim();

      // Nếu bắt đầu bằng { và có chứa "detail" hoặc "message", khả năng cao là JSON lỗi
      if (textStart.startsWith('{') && (textStart.includes('"detail"') || textStart.includes('"message"') || textStart.includes('"error"'))) {
          // Thử parse toàn bộ
          const fullText = textDecoder.decode(arrayBuffer);
          const errorJson = JSON.parse(fullText);
          const msg = errorJson.detail?.message || errorJson.message || errorJson.error || "Unknown API Error inside 200 OK";
          throw new Error(`API Error: ${msg}`);
      }
  } catch (e: any) {
      // Nếu là lỗi chúng ta vừa throw thì throw tiếp
      if (e.message && e.message.startsWith("API Error")) {
          throw e;
      }
      // Các lỗi parse JSON khác thì bỏ qua, tiếp tục decode audio
  }

  return await decodeAudioDataToPcm(arrayBuffer, speed);
}
