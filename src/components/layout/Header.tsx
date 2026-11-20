import React from 'react';
import { Menu, WifiOff, Globe, Bell } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { getDhakaDateString, formatDisplayDate } from '../../utils/date';

interface HeaderProps {
  onToggleDrawer: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleDrawer }) => {
  const { settings, lang, setLang, needsBackupReminder } = useSettings();
  const today = getDhakaDateString();

  return (
    <header className="sticky top-0 z-30 bg-emerald-700 text-white shadow-md border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-3 py-2.5 flex items-center justify-between">
        {/* Left: Menu button & Shop title */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onToggleDrawer}
            aria-label="Open menu"
            className="p-2 rounded-lg bg-emerald-800/80 hover:bg-emerald-800 text-white active:scale-95 transition-all relative"
          >
            <Menu className="w-5 h-5" />
            {needsBackupReminder && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
            )}
          </button>

          <div>
            <h1 className="font-bold text-base leading-tight tracking-tight flex items-center space-x-1.5">
              <span>{lang === 'bn' ? settings.shopNameBn : settings.shopName}</span>
            </h1>
            <p className="text-[11px] text-emerald-100 flex items-center space-x-1">
              <span>{formatDisplayDate(today, lang)}</span>
            </p>
          </div>
        </div>

        {/* Right: Offline status & Language switcher */}
        <div className="flex items-center space-x-2">
          {/* Offline Ready Badge */}
          <div className="hidden xs:flex items-center space-x-1 text-[11px] bg-emerald-800/90 text-emerald-200 px-2 py-1 rounded-md border border-emerald-600/40">
            <WifiOff className="w-3 h-3 text-emerald-300" />
            <span>১০০% অফলাইন</span>
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-800 hover:bg-emerald-900 border border-emerald-600/60 active:scale-95 transition-all"
            title="ভাষা পরিবর্তন / Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-300" />
            <span>{lang === 'bn' ? 'EN' : 'বাং'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
