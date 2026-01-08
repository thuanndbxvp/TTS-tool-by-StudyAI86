

import React, { useState, useRef, useEffect } from 'react';
import { PaletteIcon } from './icons/PaletteIcon';
import { themes, ThemeName } from '../themes';

interface ThemeSelectorProps {
  currentTheme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
}

const themeNames: { name: ThemeName; label: string }[] = [
    { name: 'green', label: 'Xanh lá cây' },
    { name: 'blue', label: 'Xanh lam' },
    { name: 'red', label: 'Đỏ' },
    { name: 'yellow', label: 'Vàng' },
    { name: 'orange', label: 'Cam' },
    { name: 'purple', label: 'Tím' },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleThemeSelect = (theme: ThemeName) => {
        onThemeChange(theme);
        setIsOpen(false);
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-full text-slate-300 hover:bg-slate-700 transition-colors"
                title="Chọn màu chủ đề"
            >
                <PaletteIcon />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
                    <div className="p-2">
                        {themeNames.map(({ name, label }) => (
                            <button
                                key={name}
                                onClick={() => handleThemeSelect(name)}
                                className={`w-full text-left flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                                    currentTheme === name 
                                        ? 'bg-slate-700 text-white' 
                                        : 'text-slate-300 hover:bg-slate-700/50'
                                }`}
                            >
                                <span 
                                    className="w-4 h-4 rounded-full mr-3 border border-white/20"
                                    style={{ backgroundColor: themes[name][500] }}
                                ></span>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};