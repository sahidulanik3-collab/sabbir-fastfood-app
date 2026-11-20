import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Payment } from '../db/types';
import { formatBDT } from '../utils/currency';
import { getDhakaDateString, formatDisplayDateTime, getDateRange } from '../utils/date';
import { useSettings } from '../context/SettingsContext';
import { Search, CreditCard, Wallet, Calendar, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../utils/export';
import { useToast } from '../context/ToastContext';

export const PaymentHistoryPage: React.FC = () => {
  const { lang } = useSettings();
  const { showToast } = useToast();

  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState(getDhakaDateString());
  const [customEnd, setCustomEnd] = useState(getDhakaDateString());
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { start, end } =
    dateFilter === 'custom'
      ? { start: customStart, end: customEnd }
      : getDateRange(dateFilter);

  const payments = useLiveQuery(
    () =>
      db.payments
        .where('date')
        .between(start, end, true, true)
        .sortBy('timestamp')
        .then((items) => items.reverse()),
    [start, end]
  );

  const filteredPayments = payments?.filter((p) => {
    const matchesMethod = methodFilter === 'all' || p.paymentMethod === methodFilter;
    const matchesType = typeFilter === 'all' || p.paymentType === typeFilter;
    const matchesSearch =
      !search ||
      p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
      (p.customerName && p.customerName.toLowerCase().includes(search.toLowerCase()));
    return matchesMethod && matchesType && matchesSearch;
  });

  const totalAmount = filteredPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const cashTotal =
    filteredPayments?.filter((p) => p.paymentMethod === 'cash').reduce((sum, p) => sum + p.amount, 0) || 0;
  const bkashTotal =
    filteredPayments?.filter((p) => p.paymentMethod === 'bkash').reduce((sum, p) => sum + p.amount, 0) || 0;
  const nagadTotal =
    filteredPayments?.filter((p) => p.paymentMethod === 'nagad').reduce((sum, p) => sum + p.amount, 0) || 0;

  const handleExportExcel = () => {
    if (!filteredPayments?.length) return;
    const data = filteredPayments.map((p) => ({
      'Payment ID': p.paymentNumber,
      'Customer': p.customerName || 'General Sale',
      'Amount (BDT)': p.amount,
      'Method': p.paymentMethod,
      'Type': p.paymentType === 'due_collection' ? 'Due Collection' : 'Direct Sale',
      'Date': p.date,
      'Time': p.time,
      'Notes': p.notes || ''
    }));

    exportToExcel([{ sheetName: 'Payments', data }], `payments-report-${start}-to-${end}`);
    showToast({ type: 'success', title: 'পেমেন্ট এক্সেল ডাউনলোড হয়েছে' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">পেমেন্ট হিস্ট্রি (Payment History)</h1>
          <p className="text-xs text-slate-500">নগদ ও ডিজিটাল মাধ্যমে সকল জমা ও আদায়</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
          <span>এক্সেল</span>
        </button>
      </div>

      {/* Date Filter Tabs */}
      <div className="flex space-x-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
        {(['today', '7days', 'month', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDateFilter(tab)}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              dateFilter === tab ? 'bg-white text-blue-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'today' ? 'আজ' : tab === '7days' ? 'গত ৭ দিন' : tab === 'month' ? 'এই মাস' : 'কাস্টম'}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
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

      {/* Payment Method Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200">
          <span className="text-[11px] font-semibold text-blue-900">মোট জমা</span>
          <div className="text-lg font-black text-blue-800">{formatBDT(totalAmount, lang)}</div>
        </div>
        <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200">
          <span className="text-[11px] font-semibold text-emerald-900">নগদ ক্যাশ</span>
          <div className="text-lg font-black text-emerald-800">{formatBDT(cashTotal, lang)}</div>
        </div>
        <div className="p-3 bg-pink-50/80 rounded-xl border border-pink-200">
          <span className="text-[11px] font-semibold text-pink-900">বিকাশ (bKash)</span>
          <div className="text-lg font-black text-pink-800">{formatBDT(bkashTotal, lang)}</div>
        </div>
        <div className="p-3 bg-orange-50/80 rounded-xl border border-orange-200">
          <span className="text-[11px] font-semibold text-orange-900">নগদ (Nagad)</span>
          <div className="text-lg font-black text-orange-800">{formatBDT(nagadTotal, lang)}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="পেমেন্ট আইডি বা নাম..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
          />
        </div>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        >
          <option value="all">সকল মাধ্যম (Cash / bKash / Nagad)</option>
          <option value="cash">নগদ (Cash)</option>
          <option value="bkash">বিকাশ (bKash)</option>
          <option value="nagad">নগদ (Nagad)</option>
          <option value="other">অন্যান্য</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        >
          <option value="all">সকল পেমেন্ট ধরন</option>
          <option value="sale">সরাসরি বিক্রয় পেমেন্ট</option>
          <option value="due_collection">বাকি আদায় (Due Collection)</option>
        </select>
      </div>

      {/* Payment List */}
      <div className="space-y-2">
        {filteredPayments?.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 text-sm">
            কোনো পেমেন্টের তথ্য নেই
          </div>
        ) : (
          filteredPayments?.map((pay) => (
            <div
              key={pay.id}
              className="p-3.5 rounded-2xl border bg-white shadow-xs hover:border-blue-300 transition-all flex items-center justify-between"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-xs text-slate-800">{pay.paymentNumber}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                      pay.paymentMethod === 'bkash'
                        ? 'bg-pink-100 text-pink-700'
                        : pay.paymentMethod === 'nagad'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {pay.paymentMethod}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      pay.paymentType === 'due_collection'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {pay.paymentType === 'due_collection' ? 'বাকি আদায়' : 'বিক্রি'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                  {pay.customerName && <span className="font-semibold text-slate-700">{pay.customerName}</span>}
                  <span>•</span>
                  <span>{formatDisplayDateTime(pay.date, pay.time, lang)}</span>
                </div>
                {pay.notes && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{pay.notes}</p>}
              </div>

              <div className="text-right shrink-0">
                <span className="text-base font-black text-emerald-800">{formatBDT(pay.amount, lang)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
