
import React, { useState, useEffect } from 'react';
import { KeyIcon } from './icons/KeyIcon';
import { checkProxyIp } from '../services/elevenLabsService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { DownloadIcon } from './icons/DownloadIcon';

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

const PHP_SCRIPT_CONTENT = `<?php
/**
 * AI Studio Backend Relay - V5: Enhanced Proxy Debugging
 * Phiên bản này thêm logs lỗi chi tiết để biết tại sao Proxy không lấy được.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, xi-api-key");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");

ini_set('max_execution_time', 180);
ini_set('display_errors', 0); // Hide PHP errors from output, we handle them via JSON

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$input = file_get_contents("php://input");
$data = json_decode($input, true);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $data = [
        'action' => 'check_ip',
        'proxy_key' => isset($_GET['key']) ? $_GET['key'] : '' 
    ];
}

$action = isset($data['action']) ? $data['action'] : '';

function getProxy($key) {
    if (!$key) return ['success' => false, 'msg' => "Missing Proxy Key"];
    
    // URL lấy proxy
    $url = "https://proxyxoay.shop/api/get.php?key=" . trim($key) . "&nhamang=Random&tinhthanh=0&t=" . time();
    
    $maxRetries = 5;
    $lastError = "";
    $debugInfo = "";

    for ($i = 0; $i < $maxRetries; $i++) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        // Rotate User Agents
        $agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/115.0"
        ];
        curl_setopt($ch, CURLOPT_USERAGENT, $agents[$i % count($agents)]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            $lastError = "Curl: $curlError";
            sleep(1); continue;
        }

        if ($response && $httpCode == 200) {
            $json = json_decode($response, true);
            
            // Debug: Lưu lại response nếu không phải JSON
            if (!$json) {
                $lastError = "Invalid JSON: " . substr($response, 0, 100); 
                sleep(1); continue;
            }

            // Trường hợp thành công
            if (isset($json['proxyhttp']) && !empty($json['proxyhttp'])) {
                return ['success' => true, 'proxy' => str_replace('::', '', $json['proxyhttp'])];
            }
            if (isset($json['proxysocks5']) && !empty($json['proxysocks5'])) {
                return ['success' => true, 'proxy' => 'socks5://' . str_replace('::', '', $json['proxysocks5'])];
            }
            if (isset($json['proxy']) && !empty($json['proxy'])) {
                return ['success' => true, 'proxy' => $json['proxy']];
            }
            
            // Trường hợp API trả về lỗi
            if (isset($json['message'])) {
                 $msg = $json['message'];
                 // Nếu lỗi do hết key hoặc sai key -> dừng luôn không retry
                 if (stripos($msg, 'key') !== false || stripos($msg, 'expired') !== false || stripos($msg, 'khong ton tai') !== false) {
                     return ['success' => false, 'msg' => "Proxy API Refused: $msg"];
                 }
                 $lastError = "API Msg: $msg";
            } else {
                $lastError = "Unknown JSON format";
            }
        } else {
            $lastError = "HTTP $httpCode";
        }
        
        sleep(2);
    }
    
    return ['success' => false, 'msg' => "Fail ($maxRetries attempts). Last: $lastError"];
}

// === ACTION 1: CHECK IP ===
if ($action === 'check_ip') {
    $proxyKey = isset($data['proxy_key']) ? $data['proxy_key'] : '';
    $finalResult = [];
    
    // Thử lấy proxy trước để xem có lỗi gì không
    $proxyRes = getProxy($proxyKey);
    
    if (!$proxyRes['success']) {
        // Trả về lỗi chi tiết từ getProxy
        echo json_encode([
            "ip" => "Error", 
            "used_proxy" => $proxyRes['msg']
        ]);
        exit;
    }

    $proxy = $proxyRes['proxy'];
    
    // Check IP thông qua Proxy đó
    $ch = curl_init("https://api.ipify.org?format=json");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_PROXY, $proxy);
    
    $res = curl_exec($ch);
    $err = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if (!$err && $res && $httpCode == 200) {
        $ipData = json_decode($res, true);
        echo json_encode([
            "ip" => isset($ipData['ip']) ? $ipData['ip'] : 'Unknown (Parse Error)',
            "used_proxy" => "Success: " . $proxy
        ]);
    } else {
        echo json_encode([
            "ip" => "Error", 
            "used_proxy" => "Proxy $proxy connected but verify failed. Curl: $err, HTTP: $httpCode"
        ]);
    }
    exit;
}

// === ACTION 2: GENERATE SPEECH ===
if ($action === 'generate_speech') {
    $apiKey = isset($data['api_key']) ? $data['api_key'] : '';
    $proxyKey = isset($data['proxy_key']) ? $data['proxy_key'] : '';
    $voiceId = isset($data['voice_id']) ? $data['voice_id'] : '';
    
    if (!$apiKey || !$voiceId) {
        http_response_code(400);
        echo json_encode(["detail" => ["message" => "Missing API Key or Voice ID"]]);
        exit;
    }

    $targetUrl = "https://api.elevenlabs.io/v1/text-to-speech/" . $voiceId;
    $elBody = [
        "text" => $data['text'],
        "model_id" => $data['model_id'],
        "voice_settings" => $data['voice_settings']
    ];
    if (isset($data['language_code'])) $elBody['language_code'] = $data['language_code'];
    
    $jsonBody = json_encode($elBody);
    
    // Logic: Lấy Proxy 1 lần, nếu fail thì báo lỗi luôn, không loop ở đây vì getProxy đã loop rồi
    $proxyRes = getProxy($proxyKey);
    if (!$proxyRes['success']) {
        http_response_code(502);
        echo json_encode(["detail" => ["message" => "Proxy Error: " . $proxyRes['msg']]]);
        exit;
    }
    $proxy = $proxyRes['proxy'];

    // Call ElevenLabs
    $ch = curl_init($targetUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $headers = ["Content-Type: application/json", "xi-api-key: " . $apiKey, "Accept: audio/mpeg"];
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_PROXY, $proxy);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if (!$curlErr && $httpCode == 200) {
        if ($contentType) header("Content-Type: " . $contentType);
        echo $response;
        exit;
    }

    // Nếu ElevenLabs lỗi, trả về nguyên văn để Client xử lý
    http_response_code(502); // 502 Bad Gateway vì upstream (ElevenLabs via Proxy) lỗi
    header("Content-Type: application/json");
    
    $errMsg = "Curl Error: $curlErr";
    if ($response) {
         // Thử lấy message từ ElevenLabs
         $jsonResp = json_decode($response, true);
         if (isset($jsonResp['detail']['message'])) {
             $errMsg = "ElevenLabs: " . $jsonResp['detail']['message'];
         } else {
             $errMsg = "ElevenLabs HTTP $httpCode";
         }
    }
    
    echo json_encode(["detail" => ["message" => $errMsg . " (Proxy: $proxy)"]]);
    exit;
}

header("Content-Type: application/json");
echo json_encode(["error" => "Invalid Action"]);
?>`;

// Key cố định
const FIXED_PROXY_KEY = 'DQvKYsgUUCGylMsMWAncay';

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  elevenLabsApiKey,
  elevenLabsBaseUrl,
  onElevenLabsConfigChange,
  geminiApiKey = '',
  onGeminiConfigChange,
  proxyKey, // We mostly ignore this prop now for display, using FIXED_PROXY_KEY
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
  const [useProxyInput, setUseProxyInput] = useState(isProxyEnabled);
  
  // Check IP State
  const [checkingIp, setCheckingIp] = useState(false);
  const [ipResult, setIpResult] = useState<{ip: string, proxy: string} | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);

  useEffect(() => {
    setElevenLabsKeysInput(elevenLabsApiKey);
    setElevenLabsUrlInput(elevenLabsBaseUrl);
    setGeminiKeyInput(geminiApiKey);
    setUseProxyInput(isProxyEnabled);
  }, [elevenLabsApiKey, elevenLabsBaseUrl, geminiApiKey, isProxyEnabled, isOpen]);
  
  // Reset IP check state when modal opens
  useEffect(() => {
      if(isOpen) {
          setIpResult(null);
          setLocalIp(null);
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
      // Always save with the Fixed Key
      onProxyConfigChange(FIXED_PROXY_KEY, useProxyInput);
  }

  const handleCheckIp = async () => {
      setCheckingIp(true);
      setIpResult(null);
      setLocalIp(null);
      setIpError(null);
      
      const keyToCheck = FIXED_PROXY_KEY;
      
      try {
          // 1. Get Local IP (Browser)
          try {
              const localReq = await fetch('https://api.ipify.org?format=json');
              const localData = await localReq.json();
              setLocalIp(localData.ip);
          } catch(e) {
              setLocalIp("Không xác định");
          }

          // 2. Get Server Output IP
          const result = await checkProxyIp(keyToCheck);
          setIpResult({ ip: result.ip, proxy: result.used_proxy });
      } catch (e: any) {
          setIpError(e.message);
      } finally {
          setCheckingIp(false);
      }
  }

  const handleDownloadPhp = () => {
      const blob = new Blob([PHP_SCRIPT_CONTENT], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ai_studio_code.php';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

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
                    {isProxyEnabled && (
                         <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded-full border border-green-700">
                             Đang bật
                         </span>
                    )}
                </h3>
                <p className="text-slate-400 text-xs mb-4">
                    Hệ thống tự động sử dụng Proxy xoay để tránh lỗi chặn IP từ ElevenLabs.
                </p>

                <div className="space-y-3">
                     <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={useProxyInput}
                                onChange={(e) => {
                                    setUseProxyInput(e.target.checked);
                                }}
                                className="rounded border-slate-600 bg-slate-700 text-[--color-primary-500] focus:ring-[--color-primary-500]"
                            />
                            <span className="text-sm font-medium text-slate-300">Bật Proxy Xoay</span>
                        </label>
                        <button 
                            onClick={handleSaveProxy} 
                            className={`bg-[--color-primary-600] hover:bg-[--color-primary-500] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm ${useProxyInput === isProxyEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={useProxyInput === isProxyEnabled}
                        >
                            Lưu
                        </button>
                    </div>
                </div>
                
                {/* Download Backend Script */}
                <div className="mt-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
                    <div className="flex items-start space-x-2">
                        <span className="text-yellow-500 text-lg">⚠️</span>
                        <div className="flex-1">
                             <p className="text-[11px] text-slate-300 mb-2 font-semibold">
                                QUAN TRỌNG: Bạn cần TẢI và UPLOAD file PHP mới này lên server để fix lỗi Proxy.
                            </p>
                             <p className="text-[10px] text-slate-400 mb-2">
                                File cũ có thể không tương thích hoặc thiếu logic retry khi API ProxyXoay bị chậm.
                            </p>
                            <button 
                                onClick={handleDownloadPhp}
                                className="w-full flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-[--color-primary-400] font-bold text-xs py-2 px-3 rounded border border-slate-500 transition-colors animate-pulse"
                            >
                                <DownloadIcon />
                                <span>Tải file ai_studio_code.php (Bản Fix lỗi)</span>
                            </button>
                        </div>
                    </div>
                </div>
                
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
                    
                    {localIp && (
                         <div className="mt-2 text-xs bg-slate-900/50 p-2 rounded border border-blue-500/30 text-blue-300">
                            <span className="text-slate-500">IP Trình duyệt (Local):</span> <span className="font-mono font-bold">{localIp}</span>
                        </div>
                    )}
                    
                    {ipResult && (
                        <div className="mt-1 text-xs bg-slate-900/50 p-2 rounded border border-green-500/30 text-green-300">
                            <div><span className="text-slate-500">IP Server (Output):</span> <span className="font-mono font-bold">{ipResult.ip}</span></div>
                            <div className="mt-1 border-t border-slate-700/50 pt-1">
                                <span className="text-slate-500">Trạng thái:</span> {ipResult.proxy}
                            </div>
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
                Sử dụng Gemini để tạo giọng đọc. Hỗ trợ các model mới nhất.
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
