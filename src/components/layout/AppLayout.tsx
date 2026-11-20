import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Header } from './Header';
import { SidebarDrawer } from './SidebarDrawer';
import { BottomNav } from './BottomNav';
import { useSettings } from '../../context/SettingsContext';
import { AlertCircle, HardDriveDownload, X } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { needsBackupReminder, dismissBackupReminder } = useSettings();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans pb-20 select-none">
      {/* Top Header */}
      <Header onToggleDrawer={() => setIsDrawerOpen(true)} />

      {/* Collapsible Mobile Drawer */}
      <SidebarDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* Overdue Backup Reminder Banner */}
      {needsBackupReminder && (
        <div className="bg-amber-500 text-slate-900 px-3 py-2 text-xs font-medium flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-slate-900 shrink-0" />
            <span>
              <strong>ব্যাকআপ রিমাইন্ডার:</strong> আপনার ফোনের ডাউনলোড ফোল্ডারে ব্যাকআপ ফাইল সেভ করুন।
            </span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <NavLink
              to="/settings"
              className="bg-slate-900 text-white px-2.5 py-1 rounded text-[11px] font-bold"
            >
              ব্যাকআপ নিন
            </NavLink>
            <button onClick={dismissBackupReminder} className="p-1 hover:bg-amber-600 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4">
        <Outlet />
      </main>

      {/* Bottom Thumb Navigation Bar */}
      <BottomNav onOpenDrawer={() => setIsDrawerOpen(true)} />
    </div>
  );
};
