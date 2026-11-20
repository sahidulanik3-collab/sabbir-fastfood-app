import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  variant?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  variant = 'emerald',
  onClick
}) => {
  const colorStyles = {
    emerald: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950 icon-bg-emerald-600',
    amber: 'bg-amber-50/70 border-amber-200/80 text-amber-950 icon-bg-amber-600',
    rose: 'bg-rose-50/70 border-rose-200/80 text-rose-950 icon-bg-rose-600',
    blue: 'bg-blue-50/70 border-blue-200/80 text-blue-950 icon-bg-blue-600',
    purple: 'bg-purple-50/70 border-purple-200/80 text-purple-950 icon-bg-purple-600',
    slate: 'bg-slate-100/70 border-slate-200/80 text-slate-900 icon-bg-slate-600'
  }[variant];

  const iconColors = {
    emerald: 'bg-emerald-600 text-white',
    amber: 'bg-amber-500 text-white',
    rose: 'bg-rose-600 text-white',
    blue: 'bg-blue-600 text-white',
    purple: 'bg-purple-600 text-white',
    slate: 'bg-slate-700 text-white'
  }[variant];

  return (
    <div
      onClick={onClick}
      className={`p-3 sm:p-4 rounded-2xl border shadow-xs transition-all ${colorStyles} ${
        onClick ? 'cursor-pointer active:scale-98 hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-wide text-slate-600 truncate">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconColors}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-black tracking-tight">{value}</div>
      {subValue && <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{subValue}</div>}
    </div>
  );
};
