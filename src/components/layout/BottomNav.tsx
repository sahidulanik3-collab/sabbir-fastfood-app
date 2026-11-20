import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Users, TrendingDown, Menu } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface BottomNavProps {
  onOpenDrawer: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenDrawer }) => {
  const { t } = useSettings();

  const mainTabs = [
    { to: '/', label: t('nav_home'), icon: LayoutDashboard },
    { to: '/sales', label: t('nav_sales'), icon: Receipt },
    { to: '/customers', label: t('nav_customers'), icon: Users },
    { to: '/expenses', label: t('nav_expenses'), icon: TrendingDown }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg px-2 py-1 flex items-center justify-around safe-bottom">
      {mainTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[11px] transition-all min-h-[48px] min-w-[56px] ${
                isActive
                  ? 'text-emerald-700 font-bold scale-105'
                  : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="truncate max-w-[64px] text-center">{tab.label}</span>
          </NavLink>
        );
      })}

      {/* Menu Drawer Toggle Button */}
      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[11px] text-slate-500 hover:text-slate-800 min-h-[48px] min-w-[56px]"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span>মেনু / Menu</span>
      </button>
    </nav>
  );
};
