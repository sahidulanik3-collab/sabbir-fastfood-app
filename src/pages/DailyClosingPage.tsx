import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logAudit } from '../db';
import type { DailyClosing } from '../db/types';
import { formatBDT, parseBDT } from '../utils/currency';
import { getDhakaDateString, formatDisplayDateTime, formatDisplayDate } from '../utils/date';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { sound } from '../utils/sound';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  CheckCircle2,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileCheck,
  History,
  RotateCcw
} from 'lucide-react';

export const DailyClosingPage: React.FC = () => {
  const { lang, settings } = useSettings();
  const { showToast } = useToast();

  const [closingDate, setClosingDate] = useState(getDhakaDateString());
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [actualCash, setActualCash] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reopen closing modal state
  const [reopeningClosing, setReopeningClosing] = useState<DailyClosing | null>(null);

  // Check if closing is already saved for this date
  const existingClosing = useLiveQuery(
    () => db.dailyClosings.where('date').equals(closingDate).first(),
    [closingDate]
  );

  // Past closings history
  const pastClosings = useLiveQuery(
    () => db.dailyClosings.orderBy('closedAt').reverse().toArray(),
    []
  );

  // Real-time calculations for closing date
  const sales = useLiveQuery(
    () => db.sales.where('date').equals(closingDate).and((s) => !s.isReversed).toArray(),
    [closingDate]
  );

  const saleItems = useLiveQuery(async () => {
    if (!sales?.length) return [];
    const saleIds = sales.map((s) => s.id);
    return db.saleItems.filter((item) => saleIds.includes(item.saleId)).toArray();
  }, [sales]);

  const payments = useLiveQuery(
    () => db.payments.where('date').equals(closingDate).toArray(),
    [closingDate]
  );

  const expenses = useLiveQuery(
    () => db.expenses.where('date').equals(closingDate).toArray(),
    [closingDate]
  );

  const otherIncome = useLiveQuery(
    () => db.otherIncome.where('date').equals(closingDate).toArray(),
    [closingDate]
  );

  // Metrics
  const totalSales = sales?.reduce((sum, s) => sum + s.payableAmount, 0) || 0;
  const totalCostOfGoods = saleItems?.reduce((sum, i) => sum + i.subtotalCost, 0) || 0;
  const totalDueCreated = sales?.reduce((sum, s) => sum + s.dueAmount, 0) || 0;

  const totalCashReceived = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalDueCollected =
    payments?.filter((p) => p.paymentType === 'due_collection').reduce((sum, p) => sum + p.amount, 0) || 0;

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.totalAmount, 0) || 0;
  const totalOtherIncome = otherIncome?.reduce((sum, i) => sum + i.amount, 0) || 0;

  const estimatedGrossProfit = totalSales - totalCostOfGoods;
  const estimatedNetProfit = estimatedGrossProfit - totalExpenses + totalOtherIncome;

  // Expected Cash in Drawer = Opening Cash + Cash Received - Cash Expenses + Other Cash Income
  const expectedClosingCash = Math.max(0, openingCash + totalCashReceived - totalExpenses + totalOtherIncome);
  const cashDifference = actualCash > 0 ? actualCash - expectedClosingCash : 0;

  // Save Daily Closing
  const handleSaveClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const now = Date.now();
      const closingId = existingClosing?.id || crypto.randomUUID();

      const closingRecord: DailyClosing = {
        id: closingId,
        date: closingDate,
        openingCash,
        totalSales,
        totalCostOfGoods,
        totalCashReceived,
        totalDueCreated,
        totalDueCollected,
        totalExpenses,
        otherIncome: totalOtherIncome,
        estimatedGrossProfit,
        estimatedNetProfit,
        expectedClosingCash,
        actualClosingCash: actualCash,
        cashDifference,
        closedAt: now,
        closedBy: settings.ownerName || 'Owner',
        notes: notes.trim() || undefined,
        isReopened: false
      };

      await db.dailyClosings.put(closingRecord);
      await logAudit('CLOSE_DAY', 'closing', closingId, `Daily closing completed for date ${closingDate}`, undefined, closingRecord);

      sound.playSuccess();
      showToast({
        type: 'success',
        title: 'দৈনিক ক্লোজিং সফলভাবে সম্পন্ন হয়েছে',
        message: `${closingDate} তারিখের হিসাব সংরক্ষিত হলো`
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'ক্লোজিং সংরক্ষণে ব্যর্থ', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reopen Closing (allows corrections)
  const handleConfirmReopen = async () => {
    if (!reopeningClosing) return;
    try {
      await db.dailyClosings.update(reopeningClosing.id, {
        isReopened: true
      });
      await logAudit('UPDATE', 'closing', reopeningClosing.id, `Reopened daily closing for ${reopeningClosing.date}`);
      showToast({
        type: 'warning',
        title: 'ক্লোজিং পুনরায় খোলা হয়েছে (Reopened)',
        message: 'এখন নতুন হিসাব সংশোধন করতে পারবেন'
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'ব্যর্থ হয়েছে', message: err.message });
    } finally {
      setReopeningClosing(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">দৈনিক ক্লোজিং (Daily Closing)</h1>
          <p className="text-xs text-slate-500">দিনের শেষে নগদ ক্যাশ ও মোট হিসাব মেলান</p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center space-x-1">
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="text-xs font-semibold p-2 border border-slate-300 rounded-xl bg-white shadow-xs"
          />
        </div>
      </div>

      {/* Already Closed Banner */}
      {existingClosing && !existingClosing.isReopened && (
        <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-xs text-emerald-900 block">
                এই দিনের ক্লোজিং ইতোমধ্যে সম্পন্ন হয়েছে
              </span>
              <span className="text-[11px] text-emerald-700">
                বন্ধের সময়: {new Date(existingClosing.closedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReopeningClosing(existingClosing)}
            className="px-2.5 py-1.5 bg-white text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-50 flex items-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>সংশোধন করুন</span>
          </button>
        </div>
      )}

      {/* Summary Metrics Grid */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
          {formatDisplayDate(closingDate, lang)} - দিনের হিসাব বিবরণী
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500">মোট বিক্রি (Sales):</span>
            <div className="text-base font-black text-emerald-700 mt-0.5">{formatBDT(totalSales, lang)}</div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500">নগদ ক্যাশ গ্রহণ:</span>
            <div className="text-base font-black text-blue-700 mt-0.5">{formatBDT(totalCashReceived, lang)}</div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500">মোট দোকান খরচ:</span>
            <div className="text-base font-black text-amber-700 mt-0.5">{formatBDT(totalExpenses, lang)}</div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500">নতুন বাকি তৈরি:</span>
            <div className="text-base font-black text-rose-700 mt-0.5">{formatBDT(totalDueCreated, lang)}</div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500">বাকি আদায় হয়েছে:</span>
            <div className="text-base font-black text-indigo-700 mt-0.5">{formatBDT(totalDueCollected, lang)}</div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-500">দিনের আনুমানিক লাভ:</span>
            <div className="text-base font-black text-emerald-800 mt-0.5">{formatBDT(estimatedNetProfit, lang)}</div>
          </div>
        </div>
      </div>

      {/* Drawer Cash Reconciliation Form */}
      {(!existingClosing || existingClosing.isReopened) && (
        <form onSubmit={handleSaveClosing} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>ক্যাশ ড্রয়ার হিসাব মেলান (Cash Drawer Reconciliation)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                দিনের শুরুতে প্রারম্ভিক ক্যাশ (Opening Cash ৳)
              </label>
              <input
                type="number"
                min="0"
                value={openingCash || ''}
                onChange={(e) => setOpeningCash(parseBDT(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                দিনের শেষে ক্যাশে গণনা করা টাকা (Actual Cash ৳) *
              </label>
              <input
                type="number"
                min="0"
                value={actualCash || ''}
                onChange={(e) => setActualCash(parseBDT(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 text-base font-black text-emerald-700 border border-slate-300 rounded-xl text-right"
                required
              />
            </div>
          </div>

          {/* Expected vs Actual preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">ক্যাশ ড্রয়ারে প্রত্যাশিত টাকা (Expected):</span>
              <span className="font-bold text-slate-800">{formatBDT(expectedClosingCash, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">আপনার গনা ক্যাশ (Counted):</span>
              <span className="font-bold text-emerald-800">{formatBDT(actualCash, lang)}</span>
            </div>
            {actualCash > 0 && (
              <div
                className={`flex justify-between font-bold pt-1 border-t border-slate-200 ${
                  cashDifference === 0
                    ? 'text-emerald-700'
                    : cashDifference > 0
                    ? 'text-blue-700'
                    : 'text-rose-700'
                }`}
              >
                <span>ক্যাশ পার্থক্য (Difference):</span>
                <span>
                  {cashDifference === 0
                    ? 'সঠিকভাবে মিলেছে (0)'
                    : cashDifference > 0
                    ? `+${formatBDT(cashDifference, lang)} বেশি`
                    : `-${formatBDT(Math.abs(cashDifference), lang)} ঘাটতি`}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ক্লোজিং মন্তব্য (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="যেমন: ক্যাশ ড্রয়ার লক করা হয়েছে"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'আজকের দিন ক্লোজ করুন'}</span>
          </button>
        </form>
      )}

      {/* Past Closings History */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center space-x-1.5">
          <History className="w-4 h-4 text-slate-500" />
          <span>পূর্ববর্তী ক্লোজিং ইতিহাস</span>
        </div>

        <div className="divide-y divide-slate-100">
          {pastClosings?.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">কোনো অতীত ক্লোজিং রেকর্ড নেই</div>
          ) : (
            pastClosings?.map((c) => (
              <div key={c.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                <div>
                  <span className="font-bold text-slate-800">{c.date}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    বিক্রি: {formatBDT(c.totalSales, lang)} | খরচ: {formatBDT(c.totalExpenses, lang)}
                  </div>
                  {c.notes && <div className="text-[10px] text-slate-400">{c.notes}</div>}
                </div>

                <div className="text-right">
                  <span className="font-black text-emerald-800">{formatBDT(c.estimatedNetProfit, lang)}</span>
                  <div className="text-[10px] text-slate-400 mt-0.5">লাভ</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reopen Confirmation Modal */}
      <ConfirmModal
        isOpen={!!reopeningClosing}
        onClose={() => setReopeningClosing(null)}
        onConfirm={handleConfirmReopen}
        title="ক্লোজিং পুনরায় খোলা"
        message={`আপনি কি নিশ্চিত ${reopeningClosing?.date} তারিখের ক্লোজিং সংশোধন করতে চান?`}
        confirmLabel="হ্যাঁ, পুনরায় খুলুন"
        danger={false}
      />
    </div>
  );
};
