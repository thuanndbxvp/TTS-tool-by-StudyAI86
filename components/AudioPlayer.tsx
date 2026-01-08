
import React from 'react';
import type { AudioResult } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface AudioPlayerProps {
  result: AudioResult;
  index: number;
  onRegenerate: (id: number, text: string) => void;
  isRegenerating: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ result, index, onRegenerate, isRegenerating }) => {
  return (
    <div className="bg-slate-700/50 p-4 rounded-lg shadow-md transition-all duration-300 hover:bg-slate-700 hover:shadow-lg hover:shadow-[--color-primary-700]/20 border border-slate-600/50 relative">
       {/* Order Badge */}
       <div className="absolute -top-3 -left-2 bg-[--color-primary-600] text-white text-xs font-bold px-2 py-1 rounded shadow-sm border border-slate-600">
        #{index + 1}
      </div>

      <p className="text-slate-300 mb-3 text-sm italic mt-2">"{result.text}"</p>
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {result.audioUrl ? (
             <audio controls src={result.audioUrl} className="w-full h-10 rounded-md">
                Trình duyệt của bạn không hỗ trợ phần tử âm thanh.
             </audio>
        ) : (
            <div className="w-full h-10 bg-red-900/20 border border-red-500/30 rounded flex items-center justify-center text-red-400 text-sm">
                Lỗi: Không có dữ liệu âm thanh
            </div>
        )}

        <div className="flex items-center space-x-2 w-full md:w-auto shrink-0">
             {/* Regenerate Button */}
            <button
                onClick={() => onRegenerate(result.id, result.text)}
                disabled={isRegenerating}
                className="flex-1 md:flex-none flex items-center justify-center bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-slate-200 font-medium py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
                title="Tạo lại đoạn này"
            >
                {isRegenerating ? <SpinnerIcon hasMargin={false} /> : <RefreshIcon />}
                <span className="ml-2 md:hidden lg:inline">Tạo lại</span>
            </button>

            {/* Download Button */}
            {result.audioUrl && (
                <a
                href={result.audioUrl}
                download={`segment_${index + 1}.wav`}
                className="flex-1 md:flex-none flex items-center justify-center bg-[--color-primary-700] hover:bg-[--color-primary-600] text-white font-medium py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
                title="Tải về file WAV"
                >
                <DownloadIcon />
                <span className="ml-2 md:hidden lg:inline">Tải về</span>
                </a>
            )}
        </div>
      </div>
    </div>
  );
};
