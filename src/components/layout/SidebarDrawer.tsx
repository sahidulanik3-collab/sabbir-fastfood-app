import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  UtensilsCrossed,
  TrendingDown,
  Users,
  CreditCard,
  PlusCircle,
  BarChart3,
  CheckCircle2,
  Settings as SettingsIcon,
  X,
  HardDriveDownload,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ isOpen, onClose }) => {
  const { settings, lang, t, needsBackupReminder } = useSettings();

  const navItems = [
    { to: '/', label: t('nav_home'), icon: LayoutDashboard, badge: null },
    { to: '/sales', label: t('nav_sales'), icon: Receipt, badge: null },
    { to: '/products', label: t('nav_products'), icon: UtensilsCrossed, badge: null },
    { to: '/expenses', label: t('nav_expenses'), icon: TrendingDown, badge: null },
    { to: '/customers', label: t('nav_customers'), icon: Users, badge: null },
    { to: '/payments', label: t('nav_payments'), icon: CreditCard, badge: null },
    { to: '/income', label: t('nav_income'), icon: PlusCircle, badge: null },
    { to: '/reports', label: t('nav_reports'), icon: BarChart3, badge: null },
    { to: '/closing', label: t('nav_closing'), icon: CheckCircle2, badge: null },
    {
      to: '/settings',
      label: t('nav_settings'),
      icon: SettingsIcon,
      badge: needsBackupReminder ? '!' : null
    }
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in"
        />
      )}

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[82vw] bg-white text-slate-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 overflow-hidden p-0.5 shadow-xs">
              <img src="./logo.png" alt="Manager POS" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">
                {lang === 'bn' ? settings.shopNameBn : settings.shopName}
              </h2>
              <p className="text-xs text-emerald-200">
                {settings.ownerName || 'Fast Food Shop POS'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-emerald-800 active:scale-95"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offline indicator banner inside drawer */}
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center space-x-2 text-xs text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">১০০% লোকাল ডাটাবেজ (IndexedDB)</span>
        </div>

        {/* Backup alert if needed */}
        {needsBackupReminder && (
          <NavLink
            to="/settings"
            onClick={onClose}
            className="m-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center space-x-2.5 text-xs text-amber-900 animate-pulse"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold block">ব্যাকআপ নেওয়ার সময় হয়েছে!</span>
              <span className="text-[11px] text-amber-700">ফোনে ডাটা সেভ করতে চাপুন</span>
            </div>
          </NavLink>
        )}

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                  }`
                }
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-amber-400 text-slate-900">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 text-center space-y-1">
          <div className="font-semibold text-slate-700">Manager POS v1.0</div>
          <div>No Cloud • No API • 100% Offline</div>
        </div>
      </aside>
    </>
  );
};
