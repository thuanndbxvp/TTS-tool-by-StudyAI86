import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';

interface SrtResultPlayerProps {
  audioUrl: string;
}

export const SrtResultPlayer: React.FC<SrtResultPlayerProps> = ({ audioUrl }) => {
  return (
    <div className="bg-slate-700/50 p-4 rounded-lg shadow-md transition-all duration-300 hover:bg-slate-700 hover:shadow-lg hover:shadow-[--color-primary-700]/20">
      <p className="text-slate-300 mb-3 text-sm font-medium">Âm thanh được tạo từ tệp SRT:</p>
      <div className="flex items-center justify-between">
        <audio controls src={audioUrl} className="w-full max-w-sm h-10">
          Trình duyệt của bạn không hỗ trợ phần tử âm thanh.
        </audio>
        <a
          href={audioUrl}
          download="combined_audio.wav"
          className="ml-4 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
          title="Tải về file WAV"
        >
          <DownloadIcon />
          <span>Tải về WAV</span>
        </a>
      </div>
    </div>
  );
};
