import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, logAudit } from '../db';
import type { Product, Sale, SaleItem } from '../db/types';
import { formatBDT } from '../utils/currency';
import { getDhakaDateString, getDhakaTimeString, formatDisplayDate } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { sound } from '../utils/sound';
import { StatCard } from '../components/common/StatCard';
import { ProductCard } from '../components/sales/ProductCard';
import { QuickDueModal } from '../components/sales/QuickDueModal';
import { QuickExpenseModal } from '../components/sales/QuickExpenseModal';
import { QuickIncomeModal } from '../components/sales/QuickIncomeModal';
import { CustomSaleModal } from '../components/sales/CustomSaleModal';
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  TrendingDown,
  ShoppingBag,
  Receipt,
  PiggyBank,
  PlusCircle,
  BarChart3,
  Layers
} from 'lucide-react';

export const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { lang, t } = useSettings();
  const { showSaleSuccess, showToast } = useToast();

  const [isDueModalOpen, setIsDueModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isCustomSaleModalOpen, setIsCustomSaleModalOpen] = useState(false);

  const todayStr = getDhakaDateString();

  // Real-time Dexie reactive queries for today's metrics
  const products = useLiveQuery(() => db.products.filter((p) => p.isAvailable).sortBy('order'), []);
  const todaySales = useLiveQuery(
    () => db.sales.where('date').equals(todayStr).and((s) => !s.isReversed).toArray(),
    [todayStr]
  );
  const todaySaleItems = useLiveQuery(
    () =>
      db.sales
        .where('date')
        .equals(todayStr)
        .and((s) => !s.isReversed)
        .toArray()
        .then((sales) => {
          const saleIds = sales.map((s) => s.id);
          return db.saleItems.filter((item) => saleIds.includes(item.saleId)).toArray();
        }),
    [todayStr]
  );
  const todayPayments = useLiveQuery(
    () => db.payments.where('date').equals(todayStr).toArray(),
    [todayStr]
  );
  const todayExpenses = useLiveQuery(
    () => db.expenses.where('date').equals(todayStr).toArray(),
    [todayStr]
  );
  const todayIncome = useLiveQuery(
    () => db.otherIncome.where('date').equals(todayStr).toArray(),
    [todayStr]
  );

  // Financial calculations
  const totalSales = todaySales?.reduce((sum, s) => sum + s.payableAmount, 0) || 0;
  const directSalesCash = todaySales?.reduce((sum, s) => sum + s.paidAmount, 0) || 0;
  const todayDueCreated = todaySales?.reduce((sum, s) => sum + s.dueAmount, 0) || 0;

  // Payments collected today (both sale and due collection)
  const totalCashReceived =
    todayPayments?.reduce((sum, p) => sum + p.amount, 0) || directSalesCash;

  const totalExpenseAmount = todayExpenses?.reduce((sum, e) => sum + e.totalAmount, 0) || 0;
  const totalOtherIncome = todayIncome?.reduce((sum, i) => sum + i.amount, 0) || 0;

  // Cost of goods sold (COGS) for gross profit
  const totalCOGS = todaySaleItems?.reduce((sum, item) => sum + item.subtotalCost, 0) || 0;
  const grossProfit = totalSales - totalCOGS;
  const netProfit = grossProfit - totalExpenseAmount + totalOtherIncome;

  const totalItemsSold = todaySaleItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalOrders = todaySales?.length || 0;

  // Count sold per product today for the badge
  const soldCountByProduct: Record<string, number> = {};
  todaySaleItems?.forEach((item) => {
    soldCountByProduct[item.productId] = (soldCountByProduct[item.productId] || 0) + item.quantity;
  });

  // Fast 1-Tap Sale Handler with Safe Instant Undo
  const handleQuickSale = async (product: Product) => {
    sound.playTap();
    const now = Date.now();
    const time = getDhakaTimeString();
    const saleId = crypto.randomUUID();
    const saleNumber = `S-${todayStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await db.transaction('rw', [db.sales, db.saleItems, db.payments], async () => {
        // 1. Create Sale
        await db.sales.add({
          id: saleId,
          saleNumber,
          totalAmount: product.sellingPrice,
          discountAmount: 0,
          payableAmount: product.sellingPrice,
          paidAmount: product.sellingPrice,
          dueAmount: 0,
          paymentMethod: 'cash',
          status: 'completed',
          date: todayStr,
          time,
          timestamp: now,
          isReversed: false
        });

        // 2. Create SaleItem
        await db.saleItems.add({
          id: crypto.randomUUID(),
          saleId,
          productId: product.id,
          productName: product.name,
          productNameBn: product.nameBn,
          quantity: 1,
          unitCostPrice: product.costPrice,
          unitSellingPrice: product.sellingPrice,
          subtotalCost: product.costPrice,
          subtotalSelling: product.sellingPrice
        });

        // 3. Create Payment record
        await db.payments.add({
          id: crypto.randomUUID(),
          paymentNumber: `PAY-${todayStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
          saleId,
          amount: product.sellingPrice,
          paymentMethod: 'cash',
          paymentType: 'sale',
          date: todayStr,
          time,
          timestamp: now,
          notes: `Instant sale: ${product.name}`
        });
      });

      await logAudit('CREATE', 'sale', saleId, `Instant sale 1x ${product.name} (৳${product.sellingPrice})`);

      // Toast with Instant Undo action
      showSaleSuccess(
        lang === 'bn' ? product.nameBn || product.name : product.name,
        formatBDT(product.sellingPrice, lang),
        async () => {
          // Undo action: soft delete / reverse sale
          await db.transaction('rw', [db.sales, db.saleItems, db.payments], async () => {
            await db.sales.update(saleId, { isReversed: true, reversedAt: Date.now() });
            const relatedPayments = await db.payments.where('saleId').equals(saleId).toArray();
            for (const p of relatedPayments) {
              await db.payments.delete(p.id);
            }
          });
          await logAudit('REVERSE', 'sale', saleId, `Reversed instant sale: ${product.name}`);
          showToast({
            type: 'warning',
            title: 'বিক্রি বাতিল (Undo) সম্পন্ন হয়েছে',
            message: `${product.name} হিসাব থেকে বাদ দেওয়া হলো`
          });
        }
      );
    } catch (err: any) {
      console.error(err);
      showToast({ type: 'error', title: 'বিক্রি রেকর্ড করতে ব্যর্থ', message: err.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Financial Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          label={t('today_sales')}
          value={formatBDT(totalSales, lang)}
          subValue={`${totalOrders}টি অর্ডার`}
          icon={TrendingUp}
          variant="emerald"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          label={t('today_cash')}
          value={formatBDT(totalCashReceived, lang)}
          subValue="নগদ ক্যাশ"
          icon={Wallet}
          variant="blue"
          onClick={() => navigate('/payments')}
        />
        <StatCard
          label={t('today_due')}
          value={formatBDT(todayDueCreated, lang)}
          subValue="আজকের বাকি"
          icon={AlertCircle}
          variant="rose"
          onClick={() => navigate('/customers')}
        />
        <StatCard
          label={t('today_expenses')}
          value={formatBDT(totalExpenseAmount, lang)}
          subValue="মোট খরচ"
          icon={TrendingDown}
          variant="amber"
          onClick={() => navigate('/expenses')}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center space-x-2 text-slate-700">
          <ShoppingBag className="w-4 h-4 text-emerald-600" />
          <span>মোট আইটেম: <strong>{totalItemsSold}</strong> টি</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center space-x-2 text-slate-700">
          <Receipt className="w-4 h-4 text-blue-600" />
          <span>অর্ডার: <strong>{totalOrders}</strong> টি</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center space-x-1.5 font-bold text-emerald-700">
          <PiggyBank className="w-4 h-4 text-emerald-600" />
          <span>লাভ: {formatBDT(netProfit, lang)}</span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setIsDueModalOpen(true)}
          className="btn-press flex flex-col items-center justify-center p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 active:scale-95 transition-all text-xs font-bold"
        >
          <span className="text-base mb-0.5">📝</span>
          <span className="truncate">{t('btn_add_due')}</span>
        </button>
        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="btn-press flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 active:scale-95 transition-all text-xs font-bold"
        >
          <span className="text-base mb-0.5">💸</span>
          <span className="truncate">{t('btn_add_expense')}</span>
        </button>
        <button
          onClick={() => setIsIncomeModalOpen(true)}
          className="btn-press flex flex-col items-center justify-center p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 active:scale-95 transition-all text-xs font-bold"
        >
          <span className="text-base mb-0.5">💰</span>
          <span className="truncate">{t('btn_add_income')}</span>
        </button>
        <button
          onClick={() => setIsCustomSaleModalOpen(true)}
          className="btn-press flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 active:scale-95 transition-all text-xs font-bold"
        >
          <span className="text-base mb-0.5">🛒</span>
          <span className="truncate">কাস্টম অর্ডার</span>
        </button>
      </div>

      {/* Food Items Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <span>খাবারের তালিকা</span>
            <span className="text-xs font-normal text-slate-500">(ট্যাপ করলেই বিক্রি যোগ হবে)</span>
          </h2>
        </div>
        <button
          onClick={() => navigate('/products')}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
        >
          <span>পণ্য পরিচালনা</span>
          <span>→</span>
        </button>
      </div>

      {/* Large Food Item Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {products?.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            todaySoldCount={soldCountByProduct[product.id] || 0}
            onQuickSale={handleQuickSale}
          />
        ))}
      </div>

      {/* Quick Action Modals */}
      <QuickDueModal
        isOpen={isDueModalOpen}
        onClose={() => setIsDueModalOpen(false)}
      />
      <QuickExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
      />
      <QuickIncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
      />
      <CustomSaleModal
        isOpen={isCustomSaleModalOpen}
        onClose={() => setIsCustomSaleModalOpen(false)}
      />
    </div>
  );
};
