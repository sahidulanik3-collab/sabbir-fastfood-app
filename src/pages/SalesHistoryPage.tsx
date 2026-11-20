import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logAudit } from '../db';
import type { Sale, SaleItem } from '../db/types';
import { formatBDT } from '../utils/currency';
import { getDhakaDateString, formatDisplayDateTime, getDateRange } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { ReceiptModal } from '../components/common/ReceiptModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import {
  Search,
  Calendar,
  Eye,
  RotateCcw,
  Receipt as ReceiptIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import { exportToExcel } from '../utils/export';

export const SalesHistoryPage: React.FC = () => {
  const { lang, t } = useSettings();
  const { showToast } = useToast();

  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState(getDhakaDateString());
  const [customEnd, setCustomEnd] = useState(getDhakaDateString());
  const [search, setSearch] = useState('');

  // Receipt Modal State
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedSaleItems, setSelectedSaleItems] = useState<SaleItem[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Void / Reversal State
  const [reversingSale, setReversingSale] = useState<Sale | null>(null);

  // Determine active date range
  const { start, end } =
    dateFilter === 'custom'
      ? { start: customStart, end: customEnd }
      : getDateRange(dateFilter);

  // Live query for sales in date range
  const sales = useLiveQuery(
    () =>
      db.sales
        .where('date')
        .between(start, end, true, true)
        .sortBy('timestamp')
        .then((items) => items.reverse()),
    [start, end]
  );

  // Open Receipt
  const handleOpenReceipt = async (sale: Sale) => {
    const items = await db.saleItems.where('saleId').equals(sale.id).toArray();
    setSelectedSale(sale);
    setSelectedSaleItems(items);
    setIsReceiptOpen(true);
  };

  // Safe Sale Reversal / Void function with Audit Trail
  const handleConfirmReversal = async () => {
    if (!reversingSale) return;
    try {
      await db.transaction('rw', [db.sales, db.customers, db.customerLedger, db.payments], async () => {
        // 1. Mark sale as reversed
        await db.sales.update(reversingSale.id, {
          isReversed: true,
          status: 'cancelled',
          reversedAt: Date.now()
        });

        // 2. If it had due, reverse customer balance & append ledger credit entry
        if (reversingSale.dueAmount > 0 && reversingSale.customerId) {
          const customer = await db.customers.get(reversingSale.customerId);
          if (customer) {
            const newBalance = Math.max(0, customer.currentBalance - reversingSale.dueAmount);
            await db.customers.update(customer.id, {
              totalDue: Math.max(0, customer.totalDue - reversingSale.dueAmount),
              currentBalance: newBalance,
              updatedAt: Date.now()
            });

            await db.customerLedger.add({
              id: crypto.randomUUID(),
              customerId: customer.id,
              date: getDhakaDateString(),
              time: new Date().toTimeString().split(' ')[0],
              timestamp: Date.now(),
              type: 'credit',
              description: `বিক্রি বাতিল সংশোধন: ${reversingSale.saleNumber}`,
              debit: 0,
              credit: reversingSale.dueAmount,
              balance: newBalance,
              saleId: reversingSale.id,
              notes: 'বিক্রি বাতিল হওয়ায় বাকি বাদ দেওয়া হয়েছে'
            });
          }
        }

        // 3. Remove payment record if paid
        const relatedPayments = await db.payments.where('saleId').equals(reversingSale.id).toArray();
        for (const p of relatedPayments) {
          await db.payments.delete(p.id);
        }
      });

      await logAudit(
        'REVERSE',
        'sale',
        reversingSale.id,
        `Voided sale ${reversingSale.saleNumber} (Amount: ৳${reversingSale.payableAmount})`,
        reversingSale
      );

      showToast({
        type: 'warning',
        title: 'বিক্রি সফলভাবে বাতিল করা হয়েছে',
        message: `ভাউচার নং ${reversingSale.saleNumber} বাতিল তালিকায় যুক্ত হলো`
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'বাতিল করতে সমস্যা হয়েছে', message: err.message });
    } finally {
      setReversingSale(null);
    }
  };

  // Filter sales
  const filteredSales = sales?.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      s.saleNumber.toLowerCase().includes(term) ||
      (s.customerName && s.customerName.toLowerCase().includes(term)) ||
      (s.customerMobile && s.customerMobile.includes(term))
    );
  });

  // Calculate totals
  const validSales = filteredSales?.filter((s) => !s.isReversed) || [];
  const totalAmountSum = validSales.reduce((sum, s) => sum + s.payableAmount, 0);
  const totalPaidSum = validSales.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalDueSum = validSales.reduce((sum, s) => sum + s.dueAmount, 0);

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredSales?.length) return;
    const data = filteredSales.map((s) => ({
      'Sale Number': s.saleNumber,
      'Date': s.date,
      'Time': s.time,
      'Customer': s.customerName || 'Walk-in',
      'Total (BDT)': s.totalAmount,
      'Discount': s.discountAmount,
      'Payable (BDT)': s.payableAmount,
      'Paid': s.paidAmount,
      'Due': s.dueAmount,
      'Payment Method': s.paymentMethod,
      'Status': s.isReversed ? 'Cancelled/Reversed' : 'Completed'
    }));

    exportToExcel([{ sheetName: 'Sales History', data }], `sales-report-${start}-to-${end}`);
    showToast({ type: 'success', title: 'এক্সেল ফাইল ডাউনলোড হয়েছে' });
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">বিক্রি তালিকা (Sales History)</h1>
          <p className="text-xs text-slate-500">সকল বিক্রয় ও রসিদ হিস্ট্রি</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>এক্সেল এক্সপোর্ট</span>
        </button>
      </div>

      {/* Date Range Tabs */}
      <div className="flex space-x-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
        {(['today', 'yesterday', '7days', 'month', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDateFilter(tab)}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              dateFilter === tab ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'today'
              ? 'আজ'
              : tab === 'yesterday'
              ? 'গতকাল'
              : tab === '7days'
              ? 'গত ৭ দিন'
              : tab === 'month'
              ? 'এই মাস'
              : 'কাস্টম রেঞ্জ'}
          </button>
        ))}
      </div>

      {/* Custom Date Picker if selected */}
      {dateFilter === 'custom' && (
        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">শুরুর তারিখ</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full text-xs p-1.5 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">শেষের তারিখ</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full text-xs p-1.5 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="ভাউচার নং বা ক্রেতার নাম খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        />
      </div>

      {/* Summary Box */}
      <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs font-semibold text-emerald-950">
        <div>
          <span className="text-slate-600">মোট বিক্রি ({validSales.length}টি):</span>
          <div className="text-base font-black text-emerald-800">{formatBDT(totalAmountSum, lang)}</div>
        </div>
        <div className="h-6 w-px bg-emerald-200" />
        <div>
          <span className="text-slate-600">নগদ জমা:</span>
          <div className="text-base font-black text-blue-700">{formatBDT(totalPaidSum, lang)}</div>
        </div>
        <div className="h-6 w-px bg-emerald-200" />
        <div>
          <span className="text-slate-600">বাকি তৈরি:</span>
          <div className="text-base font-black text-rose-700">{formatBDT(totalDueSum, lang)}</div>
        </div>
      </div>

      {/* Sales List */}
      <div className="space-y-2">
        {filteredSales?.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 text-sm">
            এই সময়ের মধ্যে কোনো বিক্রির রেকর্ড নেই
          </div>
        ) : (
          filteredSales?.map((sale) => (
            <div
              key={sale.id}
              className={`p-3.5 rounded-2xl border bg-white shadow-xs transition-all ${
                sale.isReversed
                  ? 'bg-rose-50/50 border-rose-200 opacity-60'
                  : 'hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-800 font-mono">
                    {sale.saleNumber}
                  </span>
                  {sale.isReversed ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700">
                      বাতিল / Reversed
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                        sale.paymentMethod === 'due'
                          ? 'bg-rose-100 text-rose-800'
                          : sale.paymentMethod === 'bkash'
                          ? 'bg-pink-100 text-pink-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {sale.paymentMethod}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-sm sm:text-base font-black text-emerald-800">
                    {formatBDT(sale.payableAmount, lang)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <div>
                  {sale.customerName ? (
                    <span className="font-semibold text-slate-700">ক্রেতা: {sale.customerName}</span>
                  ) : (
                    <span>সাধারণ নগদ বিক্রি</span>
                  )}
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    {formatDisplayDateTime(sale.date, sale.time, lang)}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenReceipt(sale)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 text-xs font-semibold"
                    title="রসিদ দেখুন ও প্রিন্ট করুন"
                  >
                    <ReceiptIcon className="w-3.5 h-3.5" />
                    <span>রসিদ</span>
                  </button>

                  {!sale.isReversed && (
                    <button
                      onClick={() => setReversingSale(sale)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center space-x-1 text-xs font-semibold"
                      title="বিক্রি বাতিল করুন"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>বাতিল</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={selectedSale}
        items={selectedSaleItems}
      />

      {/* Void Reversal Confirm Modal */}
      <ConfirmModal
        isOpen={!!reversingSale}
        onClose={() => setReversingSale(null)}
        onConfirm={handleConfirmReversal}
        title="বিক্রি বাতিল নিশ্চিতকরণ"
        message={`আপনি কি নিশ্চিত ভাউচার নং "${reversingSale?.saleNumber}" বাতিল করতে চান?\nএটি বাতিল করলে নগদ ও বাকির হিসাব থেকে বাদ দেওয়া হবে।`}
        confirmLabel="হ্যাঁ, বাতিল করুন"
      />
    </div>
  );
};
