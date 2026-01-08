
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
// Remove JSZip import as we are moving to direct downloads
// import JSZip from 'jszip'; 
import { generateSpeech, generateSpeechBytes } from './services/geminiService';
import { fetchElevenLabsVoices, fetchElevenLabsModels, generateElevenLabsSpeechBytes } from './services/elevenLabsService';
import { AudioResult, TtsProvider, ElevenLabsVoice, ElevenLabsModel, ElevenLabsSettings } from './types';
import { FileUploader } from './components/FileUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { DownloadIcon } from './components/icons/DownloadIcon'; // Changed icon
import { ThemeSelector } from './components/ThemeSelector';
import { themes, ThemeName } from './themes';
import { PlayIcon } from './components/icons/PlayIcon';
import { ApiKeyModal } from './components/ApiKeyModal';
import { KeyIcon } from './components/icons/KeyIcon';
import { parseSrt } from './utils/srtParser';
import { splitTextSmartly } from './utils/textSplitter';
import { createSilence, concatenatePcm, getPcmDuration, createWavBlob } from './utils/audioUtils';
import { SrtResultPlayer } from './components/SrtResultPlayer';


const geminiVoiceOptions = [
  // Giọng Nữ
  { id: 'aoede', name: 'Nữ: Aoede (Tự tin, Trang trọng)' },
  { id: 'kore', name: 'Nữ: Kore (Trầm tĩnh, Nhẹ nhàng)' },
  { id: 'zephyr', name: 'Nữ: Zephyr (Thân thiện, Ấm áp)' },
  { id: 'vega', name: 'Nữ: Vega (Sôi nổi, Rõ ràng)' },
  { id: 'pulcherrima', name: 'Nữ: Pulcherrima (Trong trẻo)' },
  { id: 'vindemiatrix', name: 'Nữ: Vindemiatrix (Mềm mại)' },
  // Giọng Nam
  { id: 'puck', name: 'Nam: Puck (Năng lượng, Tự nhiên)' },
  { id: 'charon', name: 'Nam: Charon (Trầm, Sâu lắng)' },
  { id: 'fenrir', name: 'Nam: Fenrir (Uy quyền, Mạnh mẽ)' },
  { id: 'orus', name: 'Nam: Orus (Ấm áp, Tin cậy)' },
  { id: 'rasalgethi', name: 'Nam: Rasalgethi (Rõ ràng, Hiện đại)' },
];

const geminiStyles = [
  { id: 'normal', name: 'Bình thường (Mặc định)' },
  { id: 'story', name: 'Kể chuyện (Diễn cảm, Nhấn nhá)' },
  { id: 'news', name: 'Tin tức (Chuyên nghiệp, Dứt khoát)' },
  { id: 'confide', name: 'Tâm sự (Thủ thỉ, Sâu lắng)' },
  { id: 'excited', name: 'Hào hứng (Vui tươi, Năng lượng)' },
  { id: 'persuasive', name: 'Thuyết trình (Hùng hồn, Thuyết phục)' },
];

/**
 * Danh sách giọng nói đề xuất (Featured) từ ElevenLabs.
 * Đã cập nhật các ID chuẩn để tránh lỗi "Voice not found".
 */
const elevenLabsFeaturedVoices = [
  { id: 'wyWA56cQNU2KqUW4eCsI', name: 'Clyde - Full, Diplomatic and Inviting', tags: ['Nam', 'Anh-British', 'Ngoại giao'], desc: 'Giọng nam người Anh đầy quyền lực, sắc thái và hài hước.' },
  { id: 'pNInz6ovfRbbqscEnH6S', name: 'Adam Stone', tags: ['Nam', 'Mỹ', 'Trầm ấm'], desc: 'Giọng nam trung niên, sâu lắng và thư giãn.' },
  { id: 'iP95p4H8P506H6yPscm6', name: 'Christopher', tags: ['Nam', 'Anh-British', 'Kể chuyện'], desc: 'Giọng nam người Anh, rõ ràng, phù hợp đọc truyện.' },
  { id: 'N2lVS1wzCLUEzyBA4ydS', name: 'Amelia', tags: ['Nữ', 'Mỹ', 'Nhiệt huyết'], desc: 'Giọng nữ trẻ trung, sôi nổi và biểu cảm.' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', tags: ['Nữ', 'Rõ ràng', 'Mỹ'], desc: 'Giọng nữ tiêu chuẩn, rất dễ nghe.' },
  { id: 'ErXw797nc8o4QC6JB9qu', name: 'Antoni', tags: ['Nam', 'Thanh lịch', 'Mỹ'], desc: 'Giọng nam chuyên nghiệp, phù hợp thuyết minh.' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', tags: ['Nữ', 'Dịu dàng', 'Mỹ'], desc: 'Giọng nữ nhẹ nhàng, phù hợp cho nội dung chữa lành.' },
  { id: 'AZnzlk1XhxPfqKpsCt9H', name: 'Domi', tags: ['Nam', 'Mạnh mẽ', 'Mỹ'], desc: 'Giọng nam đầy uy lực, phù hợp quảng cáo.' },
];

// Tooltip Component
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
  <div className="group relative ml-1.5 inline-flex items-center cursor-help z-10">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 transition-colors group-hover:text-[--color-primary-400]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-800 p-3 text-xs leading-relaxed text-slate-200 opacity-0 shadow-xl ring-1 ring-slate-600 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2">
      {text}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-600"></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileType, setFileType] = useState<'txt' | 'srt' | null>(null);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('elevenlabs');
  
  // Gemini State
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<string>('kore');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('other'); 
  const [selectedRegion, setSelectedRegion] = useState<string>('bac'); 
  const [selectedGeminiStyle, setSelectedGeminiStyle] = useState<string>('normal');

  // ElevenLabs State
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>(''); // Raw string with newlines
  const [elevenLabsBaseUrl, setElevenLabsBaseUrl] = useState<string>('https://api.elevenlabs.io/v1');
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [elevenLabsModels, setElevenLabsModels] = useState<ElevenLabsModel[]>([]);
  const [selectedElevenLabsVoice, setSelectedElevenLabsVoice] = useState<string>('');
  const [selectedElevenLabsModel, setSelectedElevenLabsModel] = useState<string>('eleven_multilingual_v2');
  const [isLoadingElevenLabs, setIsLoadingElevenLabs] = useState<boolean>(false);
  const [useCustomVoiceId, setUseCustomVoiceId] = useState<boolean>(false);
  const [showFeaturedVoices, setShowFeaturedVoices] = useState<boolean>(true);
  
  // Proxy Xoay State
  const [proxyKey, setProxyKey] = useState<string>('');
  const [isProxyEnabled, setIsProxyEnabled] = useState<boolean>(false);

  // ElevenLabs Advanced Settings
  const [elevenLabsSettings, setElevenLabsSettings] = useState<ElevenLabsSettings>({
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true
  });
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState<boolean>(false);

  // Common Settings
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);

  // Common State
  const [audioResults, setAudioResults] = useState<AudioResult[]>([]);
  const [srtResult, setSrtResult] = useState<{ audioUrl: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set());
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false); // Changed from isZipping
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>('green');
  
  // Refs for managing object URLs and Audio
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const generatedUrlsRef = useRef<string[]>([]);

  const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Load theme
   useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme');
      if (savedTheme && Object.keys(themes).includes(savedTheme)) {
        setTheme(savedTheme as ThemeName);
      }
    } catch (e) {
       console.error(e);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const themeColors = themes[theme];
    for (const [key, value] of Object.entries(themeColors)) {
      root.style.setProperty(`--color-primary-${key}`, value as string);
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);
  
  // Load ElevenLabs config and Proxy Key
  useEffect(() => {
    try {
      const savedElevenLabsKey = localStorage.getItem('elevenLabsApiKey');
      const savedElevenLabsBaseUrl = localStorage.getItem('elevenLabsBaseUrl');
      const savedProxyKey = localStorage.getItem('proxyKey');
      const savedIsProxyEnabled = localStorage.getItem('isProxyEnabled');

      if (savedElevenLabsKey) setElevenLabsApiKey(savedElevenLabsKey);
      if (savedElevenLabsBaseUrl) setElevenLabsBaseUrl(savedElevenLabsBaseUrl);
      if (savedProxyKey) setProxyKey(savedProxyKey);
      if (savedIsProxyEnabled !== null) setIsProxyEnabled(savedIsProxyEnabled === 'true');
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Load Gemini config
  useEffect(() => {
    try {
      const savedGeminiKey = localStorage.getItem('geminiApiKey');
      if (savedGeminiKey) setGeminiApiKey(savedGeminiKey);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Calculate text statistics
  const contentStats = useMemo(() => {
    if (!fileContent.trim()) return null;

    let textToCheck = fileContent;
    // If it's SRT, we try to parse it to count only the spoken words, not timestamps
    if (fileType === 'srt') {
        try {
            const subs = parseSrt(fileContent);
            if (subs.length > 0) {
                textToCheck = subs.map(s => s.text).join(' ');
            }
        } catch (e) {
            // Fallback to raw content if parsing fails
        }
    }

    // Split by whitespace and filter empty strings
    const wordCount = textToCheck.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    // Calculate seconds based on 150 words per minute
    const totalSeconds = (wordCount / 150) * 60;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);

    return { wordCount, minutes, seconds };
  }, [fileContent, fileType]);

  // Helper to get array of keys
  const getElevenLabsKeysList = useCallback(() => {
      return elevenLabsApiKey.split('\n').map(k => k.trim()).filter(k => k.length > 0);
  }, [elevenLabsApiKey]);

  // Fetch ElevenLabs Data when key is available and provider is selected
  useEffect(() => {
    const keys = getElevenLabsKeysList();
    if (ttsProvider === 'elevenlabs' && keys.length > 0 && elevenLabsVoices.length === 0) {
        setIsLoadingElevenLabs(true);
        // Randomly select a key for initial data fetching to rotate load on refresh
        const randomKeyIndex = Math.floor(Math.random() * keys.length);
        const keyToUse = keys[randomKeyIndex];

        Promise.all([
            fetchElevenLabsVoices(keyToUse, elevenLabsBaseUrl),
            fetchElevenLabsModels(keyToUse, elevenLabsBaseUrl)
        ]).then(([voices, models]) => {
            setElevenLabsVoices(voices);
            setElevenLabsModels(models);
            if (voices.length > 0 && !useCustomVoiceId && !selectedElevenLabsVoice) {
                // Ưu tiên chọn Clyde nếu có trong danh sách tải về
                const clyde = voices.find(v => v.voice_id === 'wyWA56cQNU2KqUW4eCsI');
                setSelectedElevenLabsVoice(clyde ? clyde.voice_id : voices[0].voice_id);
            }
            // Ensure default model exists or select the first available one
            if (!models.some(m => m.model_id === selectedElevenLabsModel)) {
                 // Ưu tiên chọn các model phổ biến nếu có
                 const preferredModel = models.find(m => m.model_id === 'eleven_multilingual_v2') 
                                     || models.find(m => m.model_id === 'eleven_turbo_v2_5')
                                     || models[0];
                 if (preferredModel) setSelectedElevenLabsModel(preferredModel.model_id);
            }
            setError(null);
        }).catch((err: any) => {
            setError(`Không thể tải dữ liệu ElevenLabs: ${err?.message || String(err)}`);
        }).finally(() => {
            setIsLoadingElevenLabs(false);
        });
    }
  }, [ttsProvider, getElevenLabsKeysList, elevenLabsBaseUrl, elevenLabsVoices.length, selectedElevenLabsModel, useCustomVoiceId, selectedElevenLabsVoice]);


  // Cleanup object URLs ONLY on unmount to prevent deleting active URLs during generation
  useEffect(() => {
    return () => {
      // Clean up all generated URLs when component unmounts
      generatedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      generatedUrlsRef.current = [];

      if (previewAudioRef.current) {
        URL.revokeObjectURL(previewAudioRef.current.src);
      }
    };
  }, []);
  
  // Helper to cleanup URLs manually when starting a new session
  const clearPreviousResults = () => {
     generatedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
     generatedUrlsRef.current = [];
     setAudioResults([]);
     setSrtResult(null);
  };

  const saveElevenLabsConfig = (keys: string, baseUrl: string) => {
      setElevenLabsApiKey(keys);
      setElevenLabsBaseUrl(baseUrl || 'https://api.elevenlabs.io/v1');
      localStorage.setItem('elevenLabsApiKey', keys);
      localStorage.setItem('elevenLabsBaseUrl', baseUrl || 'https://api.elevenlabs.io/v1');
      // Clear cached data to force refetch if key changes
      setElevenLabsVoices([]); 
      setElevenLabsModels([]);
  }

  const saveGeminiConfig = (key: string) => {
      setGeminiApiKey(key);
      localStorage.setItem('geminiApiKey', key);
  }

  const saveProxyConfig = (key: string, enabled: boolean) => {
      setProxyKey(key);
      setIsProxyEnabled(enabled);
      localStorage.setItem('proxyKey', key);
      localStorage.setItem('isProxyEnabled', String(enabled));
  }

  const handleFileSelect = useCallback((content: string, fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension === 'txt') setFileType('txt');
    else if (extension === 'srt') setFileType('srt');
    else {
      setFileType(null);
      setFileContent('');
      setError('Tệp không hợp lệ.');
      return;
    }
    // Clean up previous results when selecting a new file
    clearPreviousResults();
    
    setFileContent(content);
    setError(null);
  }, []);

  const getElevenLabsLanguageCode = () => {
      // Map app language selection to ISO codes ElevenLabs might use (or for logic)
      if (selectedLanguage === 'vietnam') return 'vi';
      if (selectedLanguage === 'japan') return 'ja';
      if (selectedLanguage === 'korea') return 'ko';
      if (selectedLanguage === 'other') return 'en'; // Default or unspecified
      return undefined;
  };

  const getInstruction = () => {
      if (ttsProvider === 'elevenlabs') return ''; // ElevenLabs performs better without instructional prompting
      
      if (selectedLanguage === 'vietnam') {
         let regionPrompt = "";
         switch (selectedRegion) {
             case 'bac': regionPrompt = "giọng miền Bắc"; break;
             case 'trung': regionPrompt = "giọng miền Trung"; break;
             case 'nam': regionPrompt = "giọng miền Nam"; break;
         }

         let stylePrompt = "";
         switch(selectedGeminiStyle) {
             case 'story': stylePrompt = "với phong cách kể chuyện diễn cảm, nhấn nhá đúng nhịp, tạo cảm xúc"; break;
             case 'news': stylePrompt = "với phong cách phát thanh viên tin tức, chuyên nghiệp, rõ ràng, dứt khoát"; break;
             case 'confide': stylePrompt = "với phong cách tâm sự nhẹ nhàng, sâu lắng, gần gũi"; break;
             case 'excited': stylePrompt = "với phong cách vui tươi, hào hứng, tràn đầy năng lượng"; break;
             case 'persuasive': stylePrompt = "với phong cách hùng hồn, thuyết phục, nhấn mạnh các ý chính"; break;
             default: stylePrompt = "tự nhiên"; break;
         }
         
         if (regionPrompt || stylePrompt) {
             return `Hãy đọc văn bản sau bằng ${regionPrompt}, ${stylePrompt}: `;
         }
      }
      return 'Hãy đọc đoạn văn sau: ';
  };

  const handlePreviewVoice = async () => {
    if (isLoading || isPreviewLoading) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      URL.revokeObjectURL(previewAudioRef.current.src);
      previewAudioRef.current = null;
    }
  
    setIsPreviewLoading(true);
    setError(null);
    
    let sampleText = "Hello, this is a preview of my voice.";
    if (selectedLanguage === 'vietnam') {
        sampleText = "Xin chào, đây là bản xem trước giọng nói của tôi với phong cách bạn đã chọn.";
    } else if (selectedLanguage === 'japan') {
        sampleText = "こんにちは、これは私の声のプレビューです。";
    } else if (selectedLanguage === 'korea') {
        sampleText = "안녕하세요, 이것은 제 목소리의 미리보기입니다.";
    }

    try {
      let audioUrl: string;
      if (ttsProvider === 'gemini') {
           const instruction = getInstruction();
           audioUrl = await generateSpeech(instruction + sampleText, selectedGeminiVoice, geminiApiKey, speechSpeed);
      } else {
           const keys = getElevenLabsKeysList();
           if (keys.length === 0) throw new Error("Vui lòng nhập API Key ElevenLabs");
           const langCode = getElevenLabsLanguageCode();
           
           // Randomly select a key for preview
           const randomKey = keys[Math.floor(Math.random() * keys.length)];
           
           // Only pass proxyKey if enabled
           const effectiveProxyKey = isProxyEnabled ? proxyKey : undefined;

           const bytes = await generateElevenLabsSpeechBytes(sampleText, selectedElevenLabsVoice, selectedElevenLabsModel, randomKey, langCode, elevenLabsBaseUrl, elevenLabsSettings, speechSpeed, effectiveProxyKey);
           const blob = createWavBlob(bytes);
           audioUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.error(e);
          setError("Không thể tự động phát. Kiểm tra quyền trình duyệt.");
          URL.revokeObjectURL(audioUrl);
          setIsPreviewLoading(false);
        });
      }
  
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPreviewLoading(false);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
           URL.revokeObjectURL(audioUrl);
           setError('Không thể phát âm thanh xem trước.');
           setIsPreviewLoading(false);
           previewAudioRef.current = null;
      }
    } catch (err) {
      if (err instanceof Error) setError(`Lỗi: ${err.message}`);
      setIsPreviewLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!fileContent) {
      setError('Vui lòng nhập nội dung.');
      return;
    }
    const elevenLabsKeys = getElevenLabsKeysList();
    if (ttsProvider === 'elevenlabs' && elevenLabsKeys.length === 0) {
        setError('Vui lòng cấu hình API Key ElevenLabs.');
        setIsModalOpen(true);
        return;
    }
    // Check Gemini Key if needed (environment variable might be missing)
    if (ttsProvider === 'gemini' && !geminiApiKey && !process.env.API_KEY) {
         setError('Vui lòng cấu hình API Key Gemini hoặc đảm bảo biến môi trường được thiết lập.');
         setIsModalOpen(true);
         return;
    }

    setIsLoading(true);
    setError(null);
    
    // Explicitly clear previous results before starting new generation
    clearPreviousResults();
    
    setProgress(null);

    const instruction = getInstruction();

    try {
      // Randomize start index for key usage to distribute load
      let elevenLabsKeyIdx = Math.floor(Math.random() * elevenLabsKeys.length);

      // Only pass proxyKey if enabled
      const effectiveProxyKey = isProxyEnabled ? proxyKey : undefined;

      if (fileType === 'srt') {
          const subtitles = parseSrt(fileContent);
          if (subtitles.length === 0) {
            throw new Error('SRT không hợp lệ.');
          }

          let currentTime = 0;
          const audioChunks: Uint8Array[] = [];
          setProgress({ current: 0, total: subtitles.length });

          const langCode = ttsProvider === 'elevenlabs' ? getElevenLabsLanguageCode() : undefined;

          for (let i = 0; i < subtitles.length; i++) {
            const sub = subtitles[i];
            setProgress({ current: i + 1, total: subtitles.length });

            const silenceDuration = sub.startTime - currentTime;
            if (silenceDuration > 0) audioChunks.push(createSilence(silenceDuration));

            const textToRead = `${instruction}${sub.text}`;
            let speechBytes: Uint8Array = new Uint8Array(0);

            if (ttsProvider === 'gemini') {
                 speechBytes = await generateSpeechBytes(textToRead, selectedGeminiVoice, geminiApiKey, speechSpeed);
                 // Delay for Gemini Rate Limit
                 if (i < subtitles.length - 1) await new Promise(r => setTimeout(r, 21000));
            } else {
                 let attempts = 0;
                 let success = false;
                 while (!success && attempts < elevenLabsKeys.length) {
                    const keyToUse = elevenLabsKeys[elevenLabsKeyIdx];
                    try {
                        speechBytes = await generateElevenLabsSpeechBytes(sub.text, selectedElevenLabsVoice, selectedElevenLabsModel, keyToUse, langCode, elevenLabsBaseUrl, elevenLabsSettings, speechSpeed, effectiveProxyKey);
                        success = true;
                        // On success, move to next key for next paragraph (Round Robin)
                        elevenLabsKeyIdx = (elevenLabsKeyIdx + 1) % elevenLabsKeys.length;
                    } catch (err) {
                         console.warn(`Key ${elevenLabsKeyIdx} failed:`, err);
                         attempts++;
                         // On failure, try next key immediately
                         elevenLabsKeyIdx = (elevenLabsKeyIdx + 1) % elevenLabsKeys.length;
                         
                         if (attempts >= elevenLabsKeys.length) throw err;
                    }
                 }
            }

            if (speechBytes && speechBytes.length > 0) {
               audioChunks.push(speechBytes);
               const speechDuration = getPcmDuration(speechBytes);
               currentTime = sub.startTime + speechDuration;
            }
          }

          if (audioChunks.length === 0) throw new Error("Không thể tạo bất kỳ âm thanh nào.");

          const finalPcm = concatenatePcm(audioChunks);
          const finalWavBlob = createWavBlob(finalPcm);
          const audioUrl = URL.createObjectURL(finalWavBlob);
          generatedUrlsRef.current.push(audioUrl); // Track the URL
          setSrtResult({ audioUrl });

      } else {
          // Use smart splitter instead of simple newline split
          const paragraphs = splitTextSmartly(fileContent);
          
          if (paragraphs.length === 0) throw new Error('Không có nội dung.');
          
          setProgress({ current: 0, total: paragraphs.length });

          const langCode = ttsProvider === 'elevenlabs' ? getElevenLabsLanguageCode() : undefined;

          for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];
            setProgress({ current: i + 1, total: paragraphs.length });
            const textToRead = `${instruction}${p}`;
            
            let audioUrl: string = '';
            let speechBytes: Uint8Array = new Uint8Array(0);

            if (ttsProvider === 'gemini') {
                 audioUrl = await generateSpeech(textToRead, selectedGeminiVoice, geminiApiKey, speechSpeed);
                 if (i < paragraphs.length - 1) await new Promise(r => setTimeout(r, 21000));
            } else {
                 let attempts = 0;
                 let success = false;
                 while (!success && attempts < elevenLabsKeys.length) {
                    const keyToUse = elevenLabsKeys[elevenLabsKeyIdx];
                    try {
                        speechBytes = await generateElevenLabsSpeechBytes(p, selectedElevenLabsVoice, selectedElevenLabsModel, keyToUse, langCode, elevenLabsBaseUrl, elevenLabsSettings, speechSpeed, effectiveProxyKey);
                        if (speechBytes && speechBytes.length > 0) {
                            success = true;
                        } else {
                            throw new Error("Empty audio bytes returned");
                        }
                        elevenLabsKeyIdx = (elevenLabsKeyIdx + 1) % elevenLabsKeys.length;
                    } catch (err) {
                        console.warn(`Key ${elevenLabsKeyIdx} failed:`, err);
                        attempts++;
                        elevenLabsKeyIdx = (elevenLabsKeyIdx + 1) % elevenLabsKeys.length;
                        if (attempts >= elevenLabsKeys.length) throw err;
                    }
                 }
                 const blob = createWavBlob(speechBytes);
                 if (blob.size <= 44) throw new Error("Generated audio is empty/silent");
                 audioUrl = URL.createObjectURL(blob);
            }
            
            // Track the new URL to prevent memory leaks, but don't revoke anything yet
            if (audioUrl) {
                generatedUrlsRef.current.push(audioUrl);
            }
            
            setAudioResults(prev => [...prev, { id: i, text: p, audioUrl }]);
          }
      }
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('Lỗi không xác định.');
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleRegenerate = async (id: number, text: string) => {
    if (regeneratingIds.has(id)) return;
    
    setRegeneratingIds(prev => new Set(prev).add(id));
    setError(null);
    
    const instruction = getInstruction();
    const textToRead = `${instruction}${text}`;
    const elevenLabsKeys = getElevenLabsKeysList();
    const langCode = ttsProvider === 'elevenlabs' ? getElevenLabsLanguageCode() : undefined;
    
    try {
        let audioUrl = '';
        let speechBytes: Uint8Array = new Uint8Array(0);

        if (ttsProvider === 'gemini') {
            audioUrl = await generateSpeech(textToRead, selectedGeminiVoice, geminiApiKey, speechSpeed);
        } else {
             if (elevenLabsKeys.length === 0) throw new Error("No ElevenLabs keys");
             
             // Only pass proxyKey if enabled
             const effectiveProxyKey = isProxyEnabled ? proxyKey : undefined;

             let success = false;
             let attempts = 0;
             while(!success && attempts < Math.min(3, elevenLabsKeys.length)) {
                const randomKeyIdx = Math.floor(Math.random() * elevenLabsKeys.length);
                const keyToUse = elevenLabsKeys[randomKeyIdx];
                try {
                    speechBytes = await generateElevenLabsSpeechBytes(text, selectedElevenLabsVoice, selectedElevenLabsModel, keyToUse, langCode, elevenLabsBaseUrl, elevenLabsSettings, speechSpeed, effectiveProxyKey);
                     if (speechBytes && speechBytes.length > 0) {
                        success = true;
                    } else {
                        throw new Error("Empty bytes");
                    }
                } catch(e) {
                    attempts++;
                }
             }
             
             if (!success || speechBytes.length === 0) throw new Error("Failed to regenerate audio");
             
             const blob = createWavBlob(speechBytes);
             if (blob.size <= 44) throw new Error("Generated audio is empty");
             audioUrl = URL.createObjectURL(blob);
        }
        
        // Track the regenerated URL
        if (audioUrl) {
             generatedUrlsRef.current.push(audioUrl);
        }

        // Update the result in the list
        setAudioResults(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, audioUrl };
            }
            return item;
        }));

    } catch (err: any) {
        setError(`Lỗi tạo lại đoạn #${id + 1}: ${err.message}`);
    } finally {
        setRegeneratingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    }
  };


  const handleDownloadAll = async () => {
    if (audioResults.length === 0) return;
    setIsDownloadingAll(true);
    
    // Simple iterative download with delay to prevent browser blocking
    try {
        for (let i = 0; i < audioResults.length; i++) {
            const res = audioResults[i];
            if (!res.audioUrl) continue;

            const link = document.createElement('a');
            link.href = res.audioUrl;
            link.download = `segment_${res.id + 1}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Add a small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (err) {
      setError('Lỗi khi tải xuống.');
    } finally {
      setIsDownloadingAll(false);
    }
  };
  
  const isDisabled = isLoading || isPreviewLoading;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans flex flex-col">
       <style>{`
        .results-scrollbar::-webkit-scrollbar { width: 8px; }
        .results-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .results-scrollbar::-webkit-scrollbar-thumb {
          background-color: var(--color-primary-700);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .results-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: var(--color-primary-600);
        }
      `}</style>
      <header className="bg-slate-800/50 backdrop-blur-sm p-4 border-b border-slate-700 shadow-lg flex items-center justify-between sticky top-0 z-10">
        <div className="flex-1"></div>
        <div className="text-center flex-grow">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-[--color-primary-400] transition-colors">
            TTS tool by StudyAI86
          </h1>
          <p className="text-center text-slate-400 mt-1">Cung cấp bởi Gemini & ElevenLabs</p>
        </div>
        <div className="flex-1 flex items-center justify-end space-x-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
              title="Cài đặt API Keys"
            >
              <KeyIcon />
              <span className="hidden md:inline">Cài đặt</span>
            </button>
            <ThemeSelector currentTheme={theme} onThemeChange={setTheme} />
        </div>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col gap-8">
        {/* Control Panel Block (Full Width) */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6 h-fit">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Column 1: Input (Larger) */}
                <div className="lg:col-span-7 flex flex-col h-full">
                    <div>
                        <h2 className="text-xl font-semibold text-[--color-primary-300] mb-3 transition-colors">1. Cung cấp Văn bản</h2>
                        <FileUploader onFileSelect={handleFileSelect} disabled={isDisabled} />
                        <div className="relative flex py-4 items-center">
                            <div className="flex-grow border-t border-[--color-primary-500]/30 transition-colors"></div>
                            <span className="flex-shrink mx-4 text-slate-500">HOẶC</span>
                            <div className="flex-grow border-t border-[--color-primary-500]/30 transition-colors"></div>
                        </div>
                        <textarea
                        value={fileContent}
                        onChange={(e) => {
                            setFileContent(e.target.value);
                            setFileType(null);
                        }}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors duration-200 min-h-[300px]"
                        placeholder="Dán hoặc gõ văn bản của bạn trực tiếp vào đây..."
                        disabled={isDisabled}
                        />
                        {contentStats && (
                            <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-slate-400 px-1 gap-2">
                                <span>Số từ: <span className="text-slate-200 font-medium">{contentStats.wordCount}</span></span>
                                <span>Ước tính thời lượng: <span className="text-slate-200 font-medium">
                                    {contentStats.minutes > 0 ? `${contentStats.minutes} phút ` : ''}{contentStats.seconds} giây
                                </span> (150 từ/phút)</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Settings (Smaller) */}
                <div className="lg:col-span-5 flex flex-col gap-6 justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-xl font-semibold text-[--color-primary-300] transition-colors">2. Cấu hình Giọng đọc</h2>
                            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                                <button 
                                    onClick={() => setTtsProvider('elevenlabs')}
                                    className={`px-3 py-1 text-sm rounded-md transition-all ${ttsProvider === 'elevenlabs' ? 'bg-[--color-primary-600] text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    disabled={isDisabled}
                                >ElevenLabs</button>
                                <button 
                                    onClick={() => setTtsProvider('gemini')}
                                    className={`px-3 py-1 text-sm rounded-md transition-all ${ttsProvider === 'gemini' ? 'bg-[--color-primary-600] text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    disabled={isDisabled}
                                >Gemini</button>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Language Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Ngôn ngữ</label>
                                <select
                                    value={selectedLanguage}
                                    onChange={(e) => setSelectedLanguage(e.target.value)}
                                    disabled={isDisabled}
                                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300"
                                >
                                    <option value="vietnam">Việt Nam</option>
                                    <option value="japan">Tiếng Nhật (Japanese)</option>
                                    <option value="korea">Tiếng Hàn (Korean)</option>
                                    <option value="other">Quốc tế (English)</option>
                                </select>
                            </div>

                            {/* Speed Control (Shared for both providers) */}
                            <div>
                                <div className="flex items-center justify-between text-sm font-medium text-slate-400 mb-2">
                                    <div className="flex items-center">
                                        <span>Tốc độ đọc</span>
                                        <InfoTooltip text="Điều chỉnh tốc độ phát lại. Tốc độ > 1.0 sẽ nhanh hơn, < 1.0 sẽ chậm hơn." />
                                    </div>
                                    <span className="text-[--color-primary-300] font-mono">{speechSpeed.toFixed(1)}x</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <span className="text-xs text-slate-500">0.5x</span>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={speechSpeed}
                                        onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                                        className="flex-grow h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[--color-primary-500]"
                                        disabled={isDisabled}
                                    />
                                    <span className="text-xs text-slate-500">2.0x</span>
                                </div>
                            </div>

                            {ttsProvider === 'gemini' ? (
                                <>
                                    {/* Warn if no key provided */}
                                    {!geminiApiKey && !process.env.API_KEY && (
                                         <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 p-3 rounded-lg text-sm mb-2">
                                            Bạn cần nhập API Key của Gemini trong phần cài đặt (hoặc cấu hình biến môi trường).
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Vùng miền (VN)</label>
                                        <select
                                        value={selectedRegion}
                                        onChange={(e) => setSelectedRegion(e.target.value)}
                                        disabled={isDisabled || selectedLanguage !== 'vietnam'}
                                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 disabled:opacity-50"
                                        >
                                        <option value="bac">Miền Bắc</option>
                                        <option value="trung">Miền Trung</option>
                                        <option value="nam">Miền Nam</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Phong cách (Styles)</label>
                                        <select
                                        value={selectedGeminiStyle}
                                        onChange={(e) => setSelectedGeminiStyle(e.target.value)}
                                        disabled={isDisabled || selectedLanguage !== 'vietnam'}
                                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 disabled:opacity-50"
                                        >
                                          {geminiStyles.map(style => (
                                            <option key={style.id} value={style.id}>{style.name}</option>
                                          ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Giọng đọc (Voice)</label>
                                        <div className="flex items-center space-x-2">
                                        <select
                                            value={selectedGeminiVoice}
                                            onChange={(e) => setSelectedGeminiVoice(e.target.value)}
                                            disabled={isDisabled}
                                            className="flex-grow bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300"
                                        >
                                            {geminiVoiceOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                        <button onClick={handlePreviewVoice} disabled={isDisabled} className="p-3 rounded-lg bg-slate-700 hover:bg-[--color-primary-600]/50 disabled:opacity-50">
                                            {isPreviewLoading ? <SpinnerIcon hasMargin={false} /> : <PlayIcon />}
                                        </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* ElevenLabs Controls */}
                                    {getElevenLabsKeysList().length === 0 && (
                                        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 p-3 rounded-lg text-sm mb-2">
                                            Bạn cần nhập API Key của ElevenLabs trong phần cài đặt (nút Cài đặt).
                                        </div>
                                    )}
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-slate-400 mb-2">Mô hình (Model)</label>
                                        <select
                                            value={selectedElevenLabsModel}
                                            onChange={(e) => setSelectedElevenLabsModel(e.target.value)}
                                            disabled={isDisabled || isLoadingElevenLabs || getElevenLabsKeysList().length === 0}
                                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 disabled:opacity-50"
                                        >
                                            {elevenLabsModels.length > 0 
                                                ? elevenLabsModels.map(m => <option key={m.model_id} value={m.model_id}>{m.name}</option>)
                                                : <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
                                            }
                                        </select>
                                        {selectedLanguage === 'vietnam' && selectedElevenLabsModel.includes('english') && (
                                            <p className="text-xs text-yellow-500 mt-1">
                                                Cảnh báo: Model 'English' có thể không đọc tốt tiếng Việt. Hãy chọn 'Multilingual' hoặc 'Turbo'.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-medium text-slate-400">Giọng đọc (Voice)</label>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                   onClick={() => setShowFeaturedVoices(!showFeaturedVoices)}
                                                   className={`text-xs px-2 py-1 rounded border ${showFeaturedVoices ? 'bg-[--color-primary-600] border-[--color-primary-500] text-white' : 'border-slate-600 text-slate-400'}`}
                                                >
                                                   Thư viện đề xuất
                                                </button>
                                                <input
                                                    type="checkbox"
                                                    id="useCustomVoice"
                                                    checked={useCustomVoiceId}
                                                    onChange={(e) => {
                                                        setUseCustomVoiceId(e.target.checked);
                                                        if (!e.target.checked && elevenLabsVoices.length > 0) {
                                                            const exists = elevenLabsVoices.some(v => v.voice_id === selectedElevenLabsVoice);
                                                            if (!exists) {
                                                                const clyde = elevenLabsVoices.find(v => v.voice_id === 'wyWA56cQNU2KqUW4eCsI');
                                                                setSelectedElevenLabsVoice(clyde ? clyde.voice_id : elevenLabsVoices[0].voice_id);
                                                            }
                                                        }
                                                    }}
                                                    className="rounded border-slate-600 bg-slate-700 text-[--color-primary-500] focus:ring-[--color-primary-500]"
                                                    disabled={isDisabled || getElevenLabsKeysList().length === 0}
                                                />
                                                <label htmlFor="useCustomVoice" className="text-xs text-slate-400 cursor-pointer select-none">
                                                    Voice ID
                                                </label>
                                            </div>
                                        </div>

                                        {showFeaturedVoices && (
                                            <div className="mb-3 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/50 rounded-lg border border-slate-700 custom-scrollbar">
                                                {elevenLabsFeaturedVoices.map(v => (
                                                    <div key={v.id} className={`p-2 rounded border cursor-pointer transition-all ${selectedElevenLabsVoice === v.id ? 'border-[--color-primary-500] bg-[--color-primary-500]/10' : 'border-slate-700 hover:border-slate-500 bg-slate-800/40'}`} onClick={() => { setSelectedElevenLabsVoice(v.id); setUseCustomVoiceId(true); }}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs font-bold text-slate-200 line-clamp-1">{v.name}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 line-clamp-1 leading-tight mb-1">{v.desc}</p>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex space-x-1">
                                                                {v.tags.slice(0, 1).map(t => <span key={t} className="text-[9px] bg-slate-700 px-1 rounded text-slate-400">{t}</span>)}
                                                            </div>
                                                            <button className="text-[9px] bg-[--color-primary-600]/80 hover:bg-[--color-primary-500] py-0.5 px-2 rounded text-white">Dùng</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center space-x-2">
                                            {useCustomVoiceId ? (
                                                <input
                                                    type="text"
                                                    value={selectedElevenLabsVoice}
                                                    onChange={(e) => setSelectedElevenLabsVoice(e.target.value)}
                                                    placeholder="Nhập Voice ID..."
                                                    disabled={isDisabled || getElevenLabsKeysList().length === 0}
                                                    className="flex-grow bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors"
                                                />
                                            ) : (
                                                <select
                                                    value={selectedElevenLabsVoice}
                                                    onChange={(e) => setSelectedElevenLabsVoice(e.target.value)}
                                                    disabled={isDisabled || isLoadingElevenLabs || getElevenLabsKeysList().length === 0}
                                                    className="flex-grow bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-slate-300 disabled:opacity-50"
                                                >
                                                    {isLoadingElevenLabs && <option>Đang tải danh sách giọng...</option>}
                                                    {!isLoadingElevenLabs && elevenLabsVoices.length === 0 && <option>Không tìm thấy giọng (Kiểm tra Key)</option>}
                                                    {elevenLabsVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                                                </select>
                                            )}
                                            
                                            <button 
                                                onClick={handlePreviewVoice} 
                                                disabled={isDisabled || getElevenLabsKeysList().length === 0 || !selectedElevenLabsVoice} 
                                                className="p-3 rounded-lg bg-slate-700 hover:bg-[--color-primary-600]/50 disabled:opacity-50"
                                                title="Nghe thử giọng này"
                                            >
                                                {isPreviewLoading ? <SpinnerIcon hasMargin={false} /> : <PlayIcon />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* ElevenLabs Advanced Settings */}
                                    <div className="mt-2 bg-slate-900/30 rounded-lg border border-slate-700 overflow-hidden transition-all">
                                        <button
                                            onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors focus:outline-none"
                                        >
                                            <h3 className="text-sm font-semibold text-[--color-primary-300] flex items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                                Điều chỉnh Giọng Nói
                                            </h3>
                                            <div className={`transform transition-transform duration-200 text-slate-400 ${isAdvancedSettingsOpen ? 'rotate-180' : ''}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </button>
                                        
                                        {isAdvancedSettingsOpen && (
                                            <div className="p-4 pt-0 space-y-5 border-t border-slate-700/50 mt-1">
                                                <div className="pt-2">
                                                    {/* Stability */}
                                                    <div>
                                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                            <div className="flex items-center">
                                                                <span>Stability (Ổn định)</span>
                                                                <InfoTooltip text="Độ ổn định càng cao, giọng đọc càng đều nhưng có thể đơn điệu. Giảm thấp để giọng cảm xúc và biến đổi nhiều hơn." />
                                                            </div>
                                                            <span className="text-[--color-primary-300] font-mono">{elevenLabsSettings.stability.toFixed(2)}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={elevenLabsSettings.stability}
                                                            onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, stability: parseFloat(e.target.value)})}
                                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[--color-primary-500]"
                                                            disabled={isDisabled || getElevenLabsKeysList().length === 0}
                                                        />
                                                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                                            <span>Biến đổi (0.0)</span>
                                                            <span>Ổn định (1.0)</span>
                                                        </div>
                                                    </div>

                                                    {/* Similarity Boost */}
                                                    <div className="mt-5">
                                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                            <div className="flex items-center">
                                                                <span>Similarity Boost (Độ tương đồng)</span>
                                                                <InfoTooltip text="Quyết định mức độ bám sát giọng gốc. Giá trị quá cao có thể gây nhiễu âm thanh, quá thấp giọng sẽ nghe chung chung." />
                                                            </div>
                                                            <span className="text-[--color-primary-300] font-mono">{elevenLabsSettings.similarityBoost.toFixed(2)}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={elevenLabsSettings.similarityBoost}
                                                            onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, similarityBoost: parseFloat(e.target.value)})}
                                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[--color-primary-500]"
                                                            disabled={isDisabled || getElevenLabsKeysList().length === 0}
                                                        />
                                                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                                            <span>Thấp (0.0)</span>
                                                            <span>Cao (1.0)</span>
                                                        </div>
                                                    </div>

                                                    {/* Style Exaggeration */}
                                                    <div className="mt-5">
                                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                            <div className="flex items-center">
                                                                <span>Style Exaggeration (Phóng đại phong cách)</span>
                                                                <InfoTooltip text="Cường điệu hóa phong cách của model. Tăng lên để giọng điệu mạnh mẽ hơn, nhưng quá cao có thể gây mất tự nhiên." />
                                                            </div>
                                                            <span className="text-[--color-primary-300] font-mono">{elevenLabsSettings.style.toFixed(2)}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.01"
                                                            value={elevenLabsSettings.style}
                                                            onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, style: parseFloat(e.target.value)})}
                                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[--color-primary-500]"
                                                            disabled={isDisabled || getElevenLabsKeysList().length === 0}
                                                        />
                                                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                                            <span>Không (0.0)</span>
                                                            <span>Rất nhiều (1.0)</span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4">
                                                        <label className="flex items-center space-x-2 cursor-pointer w-fit">
                                                            <input 
                                                                type="checkbox"
                                                                checked={elevenLabsSettings.useSpeakerBoost}
                                                                onChange={(e) => setElevenLabsSettings({...elevenLabsSettings, useSpeakerBoost: e.target.checked})}
                                                                className="rounded border-slate-600 bg-slate-700 text-[--color-primary-500] focus:ring-[--color-primary-500]"
                                                                disabled={isDisabled || getElevenLabsKeysList().length === 0}
                                                            />
                                                            <span className="text-xs text-slate-400">Speaker Boost (Tăng cường độ rõ của giọng)</span>
                                                            <InfoTooltip text="Tăng cường độ rõ ràng và âm lượng của giọng nói. Khuyên dùng để có chất lượng tốt nhất." />
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {ttsProvider === 'gemini' && selectedLanguage === 'vietnam' && (
                        <p className="text-xs text-slate-500 pt-4 text-center">
                            Gemini: Tính năng chọn giọng theo vùng miền và phong cách sử dụng Prompt Engineering để điều chỉnh ngữ điệu.
                        </p>
                        )}
                        {ttsProvider === 'elevenlabs' && (
                        <p className="text-xs text-slate-500 pt-4 text-center">
                            Mẹo: Nhập nhiều API Key để hệ thống tự động xoay vòng và tránh lỗi giới hạn.
                        </p>
                        )}
                    </div>


                    <div className="mt-auto">
                        <h2 className="text-xl font-semibold text-[--color-primary-300] mb-3 transition-colors">3. Tạo âm thanh</h2>
                        <button
                        onClick={handleGenerateAudio}
                        disabled={isDisabled || !fileContent}
                        className="w-full flex items-center justify-center bg-[--color-primary-600] hover:bg-[--color-primary-500] disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:shadow-none"
                        >
                        {isLoading ? (
                            <>
                            <SpinnerIcon />
                            Đang tạo...
                            </>
                        ) : 'Tạo Clip Âm thanh'}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Results Panel (Full Width) */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
            <h2 className="text-xl font-semibold text-[--color-primary-300] transition-colors">Kết quả</h2>
            {fileType !== 'srt' && audioResults.length > 0 && !isLoading && (
              <button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="flex items-center justify-center bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
              >
                {isDownloadingAll ? (
                  <>
                    <SpinnerIcon />
                    <span>Đang tải...</span>
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    <span>Tải Tất cả</span>
                  </>
                )}
              </button>
            )}
          </div>

          {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4 flex flex-col gap-2">
                <span>{error}</span>
                {error.includes("ElevenLabs") && (
                     <a href="https://elevenlabs.io/app/voice-lab" target="_blank" rel="noreferrer" className="text-sm underline hover:text-white w-fit">
                        → Quản lý VoiceLab trên ElevenLabs (Xóa bớt giọng)
                     </a>
                )}
              </div>
          )}
          
          {isLoading && audioResults.length === 0 && (
             <div className="flex flex-col items-center justify-center text-slate-400 h-64">
                <SpinnerIcon hasMargin={false} />
                 {progress ? (
                  <>
                    <p className="mt-4">Đang xử lý... ({progress.current}/{progress.total})</p>
                    {ttsProvider === 'gemini' && <p className="text-sm text-slate-500 mt-1">Khoảng trễ giữa các yêu cầu được áp dụng để tránh lỗi API.</p>}
                  </>
                ) : (
                  <p className="mt-4">Đang khởi tạo...</p>
                )}
            </div>
          )}

          {!isLoading && audioResults.length === 0 && !srtResult && !error && (
            <div className="flex items-center justify-center text-slate-500 h-64">
              Kết quả sẽ hiển thị ở đây.
            </div>
          )}

          {srtResult && !isLoading && <SrtResultPlayer audioUrl={srtResult.audioUrl} />}

          {(audioResults.length > 0) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-2">
              {audioResults.map((result, idx) => (
                <AudioPlayer 
                    key={result.id} 
                    result={result} 
                    index={idx} 
                    onRegenerate={handleRegenerate}
                    isRegenerating={regeneratingIds.has(result.id)}
                />
              ))}
               {isLoading && (
                <div className="col-span-1 xl:col-span-2 flex flex-col items-center justify-center text-slate-400 py-8">
                  <SpinnerIcon hasMargin={false} />
                  {progress && <p className="mt-4">Đang xử lý... ({progress.current}/{progress.total})</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <ApiKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        elevenLabsApiKey={elevenLabsApiKey}
        elevenLabsBaseUrl={elevenLabsBaseUrl}
        onElevenLabsConfigChange={saveElevenLabsConfig}
        geminiApiKey={geminiApiKey}
        onGeminiConfigChange={saveGeminiConfig}
        proxyKey={proxyKey}
        onProxyConfigChange={saveProxyConfig}
        isProxyEnabled={isProxyEnabled}
      />
    </div>
  );
};

export default App;
