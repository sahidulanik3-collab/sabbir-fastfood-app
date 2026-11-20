import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logAudit } from '../db';
import type { Expense, ExpenseCategory } from '../db/types';
import { formatBDT, parseBDT } from '../utils/currency';
import { getDhakaDateString, getDhakaTimeString, formatDisplayDateTime, getDateRange } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Plus, Search, Calendar, Trash2, Edit2, TrendingDown, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../utils/export';

export const ExpensesPage: React.FC = () => {
  const { lang, t } = useSettings();
  const { showToast } = useToast();

  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState(getDhakaDateString());
  const [customEnd, setCustomEnd] = useState(getDhakaDateString());
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Gas Cylinder');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('pcs');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const categories = useLiveQuery(() => db.expenseCategories.toArray(), []);

  // Determine active date range
  const { start, end } =
    dateFilter === 'custom'
      ? { start: customStart, end: customEnd }
      : getDateRange(dateFilter);

  const expenses = useLiveQuery(
    () =>
      db.expenses
        .where('date')
        .between(start, end, true, true)
        .sortBy('timestamp')
        .then((items) => items.reverse()),
    [start, end]
  );

  const openAddModal = () => {
    setEditingExpense(null);
    setTitle('');
    setCategory(categories?.[0]?.name || 'Gas Cylinder');
    setQuantity('');
    setUnit('pcs');
    setUnitPrice(0);
    setTotalAmount(0);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setCategory(exp.category);
    setQuantity(exp.quantity ? exp.quantity.toString() : '');
    setUnit(exp.unit || 'pcs');
    setUnitPrice(exp.unitPrice || 0);
    setTotalAmount(exp.totalAmount);
    setNotes(exp.notes || '');
    setIsModalOpen(true);
  };

  // Auto calculate total if quantity and unit price are entered
  const handleQuantityOrPriceChange = (q: string, up: number) => {
    setQuantity(q);
    setUnitPrice(up);
    const parsedQ = parseFloat(q);
    if (!isNaN(parsedQ) && up > 0) {
      setTotalAmount(Math.round(parsedQ * up));
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      showToast({ type: 'error', title: 'টাকার পরিমাণ লিখুন' });
      return;
    }
    if (!title.trim()) {
      showToast({ type: 'error', title: 'খরচের নাম লিখুন' });
      return;
    }

    try {
      const now = Date.now();
      const today = getDhakaDateString();
      const time = getDhakaTimeString();

      if (editingExpense) {
        const updated: Expense = {
          ...editingExpense,
          title: title.trim(),
          category,
          quantity: quantity ? parseFloat(quantity) : undefined,
          unit: quantity ? unit : undefined,
          unitPrice: unitPrice > 0 ? unitPrice : undefined,
          totalAmount,
          notes: notes.trim() || undefined
        };
        await db.expenses.put(updated);
        await logAudit('UPDATE', 'expense', editingExpense.id, `Updated expense: ${title}`, editingExpense, updated);
        showToast({ type: 'success', title: 'খরচ সফলভাবে আপডেট হয়েছে' });
      } else {
        const id = crypto.randomUUID();
        const expenseNumber = `EXP-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
        const newExp: Expense = {
          id,
          expenseNumber,
          title: title.trim(),
          category,
          quantity: quantity ? parseFloat(quantity) : undefined,
          unit: quantity ? unit : undefined,
          unitPrice: unitPrice > 0 ? unitPrice : undefined,
          totalAmount,
          date: today,
          time,
          timestamp: now,
          notes: notes.trim() || undefined
        };
        await db.expenses.add(newExp);
        await logAudit('CREATE', 'expense', id, `Created expense: ${title} (৳${totalAmount})`);
        showToast({ type: 'success', title: 'খরচ সফলভাবে যোগ করা হয়েছে' });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast({ type: 'error', title: 'খরচ সেভ করতে সমস্যা', message: err.message });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    try {
      await db.expenses.delete(deletingExpense.id);
      await logAudit('DELETE', 'expense', deletingExpense.id, `Deleted expense: ${deletingExpense.title} (৳${deletingExpense.totalAmount})`);
      showToast({ type: 'success', title: 'খরচ মুছে ফেলা হয়েছে' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'মুছতে ব্যর্থ', message: err.message });
    } finally {
      setDeletingExpense(null);
    }
  };

  const filteredExpenses = expenses?.filter((exp) => {
    const matchesSearch =
      exp.title.toLowerCase().includes(search.toLowerCase()) ||
      exp.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalExpenseSum = filteredExpenses?.reduce((sum, e) => sum + e.totalAmount, 0) || 0;

  const handleExportExcel = () => {
    if (!filteredExpenses?.length) return;
    const data = filteredExpenses.map((e) => ({
      'Voucher': e.expenseNumber,
      'Title': e.title,
      'Category': e.category,
      'Quantity': e.quantity ? `${e.quantity} ${e.unit || ''}` : '',
      'Unit Price': e.unitPrice || '',
      'Total (BDT)': e.totalAmount,
      'Date': e.date,
      'Time': e.time,
      'Notes': e.notes || ''
    }));

    exportToExcel([{ sheetName: 'Expenses', data }], `expense-report-${start}-to-${end}`);
    showToast({ type: 'success', title: 'এক্সেল ফাইল ডাউনলোড হয়েছে' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">খরচ সমূহ (Expenses)</h1>
          <p className="text-xs text-slate-500">গ্যাস, কাঁচামাল, তেল, ভাড়া ও অন্যান্য খরচ</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="p-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 active:scale-95"
            title="এক্সেল ডাউনলোড"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={openAddModal}
            className="btn-press flex items-center space-x-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন খরচ</span>
          </button>
        </div>
      </div>

      {/* Date Filter Tabs */}
      <div className="flex space-x-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
        {(['today', 'yesterday', '7days', 'month', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDateFilter(tab)}
            className={`px-3 py-1.5 rounded-lg transition-all shrink-0 ${
              dateFilter === tab ? 'bg-white text-amber-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
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

      {/* Custom Date Range */}
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

      {/* Search & Category Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="খরচ বা ক্যাটাগরি খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        >
          <option value="all">সকল ক্যাটাগরি</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.name}>
              {lang === 'bn' ? c.nameBn || c.name : c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Total Expense Header Banner */}
      <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-amber-900">মোট খরচ ({filteredExpenses?.length || 0}টি):</span>
          <div className="text-xl font-black text-amber-800">{formatBDT(totalExpenseSum, lang)}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
          <TrendingDown className="w-5 h-5" />
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-2">
        {filteredExpenses?.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 text-sm">
            এই সময়ে কোনো খরচের তথ্য নেই
          </div>
        ) : (
          filteredExpenses?.map((exp) => (
            <div
              key={exp.id}
              className="p-3.5 rounded-2xl border bg-white shadow-xs hover:border-amber-300 transition-all flex items-center justify-between"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm text-slate-800 truncate">{exp.title}</h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">
                    {exp.category}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                  <span>{formatDisplayDateTime(exp.date, exp.time, lang)}</span>
                  {exp.quantity && (
                    <>
                      <span>•</span>
                      <span>
                        {exp.quantity} {exp.unit}
                        {exp.unitPrice ? ` @ ৳${exp.unitPrice}` : ''}
                      </span>
                    </>
                  )}
                </div>
                {exp.notes && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{exp.notes}</p>}
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <span className="text-base font-black text-amber-800">
                  {formatBDT(exp.totalAmount, lang)}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(exp)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingExpense(exp)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'খরচ সম্পাদনা' : 'নতুন খরচ যোগ করুন'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveExpense} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">খরচের নাম / বিবরণ</label>
            <input
              type="text"
              placeholder="যেমন: গ্যাস সিলিন্ডার, মুরগি ক্রয়, ভোজ্য তেল"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-amber-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>
                  {lang === 'bn' ? c.nameBn || c.name : c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity, Unit & Unit Price */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পরিমাণ</label>
              <input
                type="number"
                step="any"
                placeholder="যেমন: ১"
                value={quantity}
                onChange={(e) => handleQuantityOrPriceChange(e.target.value, unitPrice)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">একক (Unit)</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="pcs">টি / Pcs</option>
                <option value="kg">কেজি (Kg)</option>
                <option value="liter">লিটার (Liter)</option>
                <option value="cylinder">সিলিন্ডার</option>
                <option value="packet">প্যাকেট</option>
                <option value="month">মাস</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">একক দর (৳)</label>
              <input
                type="number"
                placeholder="0"
                value={unitPrice || ''}
                onChange={(e) => handleQuantityOrPriceChange(quantity, parseBDT(e.target.value))}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 text-right"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মোট খরচ (BDT ৳)</label>
            <input
              type="number"
              min="1"
              value={totalAmount || ''}
              onChange={(e) => setTotalAmount(parseBDT(e.target.value))}
              className="w-full px-3 py-2 text-lg font-black text-amber-700 rounded-lg border border-slate-300 text-right focus:outline-amber-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="যেমন: দোকান ভাড়ার রসিদ"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            {editingExpense ? 'পরিবর্তন সংরক্ষণ করুন' : 'খরচ সংরক্ষণ করুন'}
          </button>
        </form>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDeleteExpense}
        title="খরচ মুছে ফেলা"
        message={`আপনি কি নিশ্চিত "${deletingExpense?.title}" (৳${deletingExpense?.totalAmount}) মুছে ফেলতে চান?`}
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
      />
    </div>
  );
};
