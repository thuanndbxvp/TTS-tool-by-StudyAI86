
import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';
import { checkProxyIp } from '../services/elevenLabsService';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ElevenLabs props
  elevenLabsApiKey: string;
  elevenLabsBaseUrl: string;
  onElevenLabsConfigChange: (keys: string, baseUrl: string) => void;
  // Gemini props
  geminiApiKey?: string;
  onGeminiConfigChange?: (key: string) => void;
  // Proxy props
  proxyKey: string;
  onProxyConfigChange: (key: string, enabled: boolean) => void;
  isProxyEnabled: boolean;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  elevenLabsApiKey,
  elevenLabsBaseUrl,
  onElevenLabsConfigChange,
  geminiApiKey = '',
  onGeminiConfigChange,
  proxyKey,
  onProxyConfigChange,
  isProxyEnabled
}) => {
  // ElevenLabs local state
  const [elevenLabsKeysInput, setElevenLabsKeysInput] = useState(elevenLabsApiKey);
  const [elevenLabsUrlInput, setElevenLabsUrlInput] = useState(elevenLabsBaseUrl);
  const [isEditingElevenLabs, setIsEditingElevenLabs] = useState(false);

  // Gemini local state
  const [geminiKeyInput, setGeminiKeyInput] = useState(geminiApiKey);
  const [isEditingGemini, setIsEditingGemini] = useState(false);

  // Proxy local state
  const [proxyKeyInput, setProxyKeyInput] = useState(proxyKey);
  const [useProxyInput, setUseProxyInput] = useState(isProxyEnabled);
  const [isEditingProxy, setIsEditingProxy] = useState(false);
  
  // Check IP State
  const [checkingIp, setCheckingIp] = useState(false);
  const [ipResult, setIpResult] = useState<{ip: string, proxy: string} | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);

  useEffect(() => {
    setElevenLabsKeysInput(elevenLabsApiKey);
    setElevenLabsUrlInput(elevenLabsBaseUrl);
    setGeminiKeyInput(geminiApiKey);
    setProxyKeyInput(proxyKey);
    setUseProxyInput(isProxyEnabled);
  }, [elevenLabsApiKey, elevenLabsBaseUrl, geminiApiKey, proxyKey, isProxyEnabled, isOpen]);
  
  // Reset IP check state when modal opens
  useEffect(() => {
      if(isOpen) {
          setIpResult(null);
          setIpError(null);
      }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSaveElevenLabs = () => {
    onElevenLabsConfigChange(elevenLabsKeysInput, elevenLabsUrlInput.trim());
    setIsEditingElevenLabs(false);
  }

  const handleSaveGemini = () => {
    if (onGeminiConfigChange) {
        onGeminiConfigChange(geminiKeyInput.trim());
        setIsEditingGemini(false);
    }
  }

  const handleSaveProxy = () => {
      onProxyConfigChange(proxyKeyInput.trim(), useProxyInput);
      setIsEditingProxy(false);
  }

  const handleCheckIp = async () => {
      setCheckingIp(true);
      setIpResult(null);
      setIpError(null);
      
      // Use the value from the input if editing, otherwise the saved prop
      const keyToCheck = isEditingProxy ? proxyKeyInput : proxyKey;
      
      try {
          const result = await checkProxyIp(keyToCheck);
          setIpResult({ ip: result.ip, proxy: result.used_proxy });
      } catch (e: any) {
          setIpError(e.message);
      } finally {
          setCheckingIp(false);
      }
  }

  const keyCount = elevenLabsApiKey.split('\n').filter(k => k.trim()).length;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apiKeyModalTitle"
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg m-4 relative flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fade-in-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-700"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="p-2 overflow-y-auto custom-scrollbar">
            <h2 id="apiKeyModalTitle" className="text-2xl font-bold text-[--color-primary-400] mb-2 text-center transition-colors">Quản lý API Keys</h2>
            
            {/* ElevenLabs Section */}
            <div className="mb-4 pt-6 border-t border-slate-600">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-between">
                 <div className="flex items-center">
                    <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent mr-2">ElevenLabs</span>
                 </div>
                 {!isEditingElevenLabs && keyCount > 0 && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full border border-slate-600">
                        {keyCount} keys
                    </span>
                 )}
              </h3>
               <p className="text-slate-400 text-xs mb-4">
                Nhập nhiều API key (mỗi dòng 1 key) để tự động xoay vòng tránh lỗi spam.
              </p>
              
              {!isEditingElevenLabs && keyCount > 0 ? (
                <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                   <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center">
                          <KeyIcon />
                          <span className="ml-3 font-mono text-slate-300 text-sm">Đang sử dụng {keyCount} key(s)</span>
                       </div>
                       <button onClick={() => setIsEditingElevenLabs(true)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                          Cấu hình
                       </button>
                   </div>
                </div>
              ) : (
                 <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Danh sách API Keys (Mỗi key một dòng)</label>
                        <textarea
                            value={elevenLabsKeysInput}
                            onChange={(e) => setElevenLabsKeysInput(e.target.value)}
                            className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 text-sm font-mono hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors"
                            placeholder="xi-api-key-1...&#10;xi-api-key-2..."
                        />
                    </div>
                    <div className="flex space-x-2 justify-end">
                         {isEditingElevenLabs && (
                            <button onClick={() => { setIsEditingElevenLabs(false); setElevenLabsKeysInput(elevenLabsApiKey); }} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
                               Hủy
                            </button>
                         )}
                        <button onClick={handleSaveElevenLabs} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
                            Lưu Cấu Hình
                        </button>
                    </div>
                </div>
              )}
            </div>

            {/* Proxy Xoay Section */}
            <div className="mb-4 pt-6 border-t border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-between">
                    <div className="flex items-center">
                        <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mr-2">Proxy Xoay (ProxyXoay.shop)</span>
                    </div>
                    {isProxyEnabled && !isEditingProxy && (
                         <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded-full border border-green-700">
                             Đang bật
                         </span>
                    )}
                </h3>
                <p className="text-slate-400 text-xs mb-4">
                    Tự động đổi IP để tránh bị ElevenLabs chặn khi tạo số lượng lớn.
                </p>

                {!isEditingProxy && proxyKey ? (
                     <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className="font-mono text-slate-300 text-sm truncate w-32">Key: {proxyKey}</span>
                            </div>
                            <button onClick={() => setIsEditingProxy(true)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                                Cấu hình
                            </button>
                        </div>
                     </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                             <label className="flex items-center space-x-2 cursor-pointer mb-3">
                                <input 
                                    type="checkbox"
                                    checked={useProxyInput}
                                    onChange={(e) => setUseProxyInput(e.target.checked)}
                                    className="rounded border-slate-600 bg-slate-700 text-[--color-primary-500] focus:ring-[--color-primary-500]"
                                />
                                <span className="text-sm font-medium text-slate-300">Bật sử dụng Proxy Xoay</span>
                            </label>

                            <label className="block text-xs font-medium text-slate-400 mb-1">Proxy API Key</label>
                            <input
                                type="text"
                                value={proxyKeyInput}
                                onChange={(e) => setProxyKeyInput(e.target.value)}
                                disabled={!useProxyInput}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 text-sm font-mono disabled:opacity-50"
                                placeholder="Nhập Key lấy Proxy..."
                            />
                        </div>
                         <div className="flex space-x-2 justify-end">
                             {isEditingProxy && (
                                <button onClick={() => { setIsEditingProxy(false); setProxyKeyInput(proxyKey); setUseProxyInput(isProxyEnabled); }} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
                                   Hủy
                                </button>
                             )}
                            <button onClick={handleSaveProxy} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
                                Lưu Cấu Hình
                            </button>
                        </div>
                    </div>
                )}
                
                {/* IP Check Tool - Always Visible */}
                <div className="mt-4 pt-3 border-t border-slate-700">
                    <div className="flex items-center justify-between">
                         <span className="text-xs text-slate-400">Kiểm tra kết nối IP đầu ra</span>
                         <button 
                            onClick={handleCheckIp}
                            disabled={checkingIp}
                            className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded flex items-center space-x-1 border border-slate-600 transition-colors"
                         >
                            {checkingIp && <SpinnerIcon hasMargin={false} />}
                            <span>{checkingIp ? 'Đang check...' : 'Kiểm tra IP'}</span>
                         </button>
                    </div>
                    
                    {ipResult && (
                        <div className="mt-2 text-xs bg-slate-900/50 p-2 rounded border border-green-500/30 text-green-300">
                            <div><span className="text-slate-500">IP hiện tại:</span> <span className="font-mono font-bold">{ipResult.ip}</span></div>
                            <div><span className="text-slate-500">Qua Proxy:</span> {ipResult.proxy}</div>
                        </div>
                    )}
                    
                    {ipError && (
                        <div className="mt-2 text-xs bg-slate-900/50 p-2 rounded border border-red-500/30 text-red-300">
                            Lỗi: {ipError}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Gemini Section */}
            <div className="mb-4 pt-6 border-t border-slate-600">
               <h3 className="text-lg font-semibold text-white mb-2 flex items-center justify-between">
                 <div className="flex items-center">
                    <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mr-2">Google Gemini</span>
                 </div>
                 {!isEditingGemini && geminiApiKey && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full border border-slate-600">
                        Đã nhập
                    </span>
                 )}
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                Sử dụng Gemini 2.5 Flash để tạo giọng đọc. Cần có API Key từ Google AI Studio.
              </p>

               {!isEditingGemini && geminiApiKey ? (
                <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                   <div className="flex items-center justify-between">
                       <div className="flex items-center">
                          <KeyIcon />
                          <span className="ml-3 font-mono text-slate-300 text-sm">
                              {geminiApiKey.substring(0, 4)}...{geminiApiKey.substring(geminiApiKey.length - 4)}
                          </span>
                       </div>
                       <button onClick={() => setIsEditingGemini(true)} className="text-[--color-primary-400] hover:text-[--color-primary-300] text-sm font-semibold transition-colors">
                          Cấu hình
                       </button>
                   </div>
                </div>
              ) : (
                <div className="space-y-3">
                   <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Gemini API Key</label>
                        <input
                            type="password"
                            value={geminiKeyInput}
                            onChange={(e) => setGeminiKeyInput(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-slate-300 text-sm font-mono hover:border-[--color-primary-500]/70 focus:ring-2 focus:ring-[--color-primary-500] focus:border-[--color-primary-500] transition-colors"
                            placeholder="AIzaSy..."
                        />
                         <p className="text-[10px] text-slate-500 mt-1">
                             Nếu bỏ trống, ứng dụng sẽ thử dùng biến môi trường (nếu có).
                         </p>
                    </div>
                    <div className="flex space-x-2 justify-end">
                         {isEditingGemini && (
                            <button onClick={() => { setIsEditingGemini(false); setGeminiKeyInput(geminiApiKey); }} className="text-slate-400 hover:text-white px-3 py-2 text-sm">
                               Hủy
                            </button>
                         )}
                        <button onClick={handleSaveGemini} className="bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
                            Lưu Cấu Hình
                        </button>
                    </div>
                </div>
              )}
            </div>

        </div>
        
        <p className="text-xs text-slate-500 mt-4 text-center border-t border-slate-700 pt-4">
          Keys được lưu cục bộ trên trình duyệt của bạn.
        </p>
      </div>
      <style>{`
        @keyframes fade-in-scale {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #475569;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};
