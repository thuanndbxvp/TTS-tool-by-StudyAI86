

import React, { useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploaderProps {
  onFileSelect: (content: string, fileName: string) => void;
  disabled: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'text/plain' || file.name.endsWith('.srt'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onFileSelect(text, file.name);
      };
      reader.readAsText(file);
    } else {
      alert('Vui lòng chọn một tệp .txt hoặc .srt hợp lệ.');
    }
     // Reset the input value to allow re-uploading the same file
    if(event.target) {
      event.target.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".txt,.srt"
        disabled={disabled}
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className="w-full bg-slate-700/50 border-2 border-dashed border-slate-600 hover:border-[--color-primary-400] hover:bg-[--color-primary-500]/10 text-slate-300 font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UploadIcon />
        <span>Nhấn để chọn một tệp .txt hoặc .srt</span>
      </button>
    </div>
  );
};