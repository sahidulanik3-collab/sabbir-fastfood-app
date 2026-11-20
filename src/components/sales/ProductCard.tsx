import React from 'react';
import type { Product } from '../../db/types';
import { formatBDT } from '../../utils/currency';
import { useSettings } from '../../context/SettingsContext';
import { Plus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  todaySoldCount?: number;
  onQuickSale: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  todaySoldCount = 0,
  onQuickSale
}) => {
  const { lang } = useSettings();

  return (
    <button
      onClick={() => onQuickSale(product)}
      className="btn-press group relative flex flex-col justify-between p-3.5 sm:p-4 bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm hover:border-emerald-500 hover:shadow-md active:bg-emerald-50/50 transition-all text-left w-full h-[135px] sm:h-[150px] overflow-hidden"
    >
      {/* Sold Badge if sold today */}
      {todaySoldCount > 0 && (
        <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
          আজ {todaySoldCount}টি
        </span>
      )}

      {/* Product Image / Icon */}
      <div className="flex items-center space-x-2.5">
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-xs group-hover:scale-110 transition-transform">
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <span>{product.icon || '🍔'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-bold text-sm sm:text-base text-slate-800 leading-tight truncate">
            {lang === 'bn' ? product.nameBn || product.name : product.name}
          </h3>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{product.category}</p>
        </div>
      </div>

      {/* Price & Tap to add */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
        <div>
          <span className="text-base sm:text-lg font-black text-emerald-700">
            {formatBDT(product.sellingPrice, lang)}
          </span>
        </div>
        <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          <Plus className="w-3.5 h-3.5" />
          <span>যোগ করুন</span>
        </div>
      </div>
    </button>
  );
};
