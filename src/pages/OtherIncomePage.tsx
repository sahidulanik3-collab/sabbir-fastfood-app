import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logAudit } from '../db';
import type { OtherIncome } from '../db/types';
import { formatBDT, parseBDT } from '../utils/currency';
import { getDhakaDateString, getDhakaTimeString, formatDisplayDateTime } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Plus, Trash2, Edit2, PlusCircle, Search } from 'lucide-react';

export const OtherIncomePage: React.FC = () => {
  const { lang } = useSettings();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<OtherIncome | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<OtherIncome | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Delivery Charges');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');

  const incomes = useLiveQuery(() => db.otherIncome.orderBy('timestamp').reverse().toArray(), []);

  const openAddModal = () => {
    setEditingIncome(null);
    setTitle('');
    setCategory('Delivery Charges');
    setAmount(0);
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (inc: OtherIncome) => {
    setEditingIncome(inc);
    setTitle(inc.title);
    setCategory(inc.category);
    setAmount(inc.amount);
    setDescription(inc.description || '');
    setIsModalOpen(true);
  };

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      showToast({ type: 'error', title: 'টাকার পরিমাণ লিখুন' });
      return;
    }
    if (!title.trim()) {
      showToast({ type: 'error', title: 'শিরোনাম লিখুন' });
      return;
    }

    try {
      const now = Date.now();
      const today = getDhakaDateString();
      const time = getDhakaTimeString();

      if (editingIncome) {
        const updated: OtherIncome = {
          ...editingIncome,
          title: title.trim(),
          category,
          amount,
          description: description.trim() || undefined
        };
        await db.otherIncome.put(updated);
        await logAudit('UPDATE', 'closing', editingIncome.id, `Updated other income: ${title}`, editingIncome, updated);
        showToast({ type: 'success', title: 'আয় সফলভাবে আপডেট হয়েছে' });
      } else {
        const id = crypto.randomUUID();
        const incomeNumber = `INC-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
        const newInc: OtherIncome = {
          id,
          incomeNumber,
          title: title.trim(),
          category,
          amount,
          date: today,
          time,
          timestamp: now,
          description: description.trim() || undefined
        };
        await db.otherIncome.add(newInc);
        await logAudit('CREATE', 'closing', id, `Added other income: ${title} (৳${amount})`);
        showToast({ type: 'success', title: 'অন্যান্য আয় যোগ করা হয়েছে' });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast({ type: 'error', title: 'আয় সংরক্ষণ ব্যর্থ', message: err.message });
    }
  };

  const handleDeleteIncome = async () => {
    if (!deletingIncome) return;
    try {
      await db.otherIncome.delete(deletingIncome.id);
      await logAudit('DELETE', 'closing', deletingIncome.id, `Deleted income: ${deletingIncome.title}`);
      showToast({ type: 'success', title: 'আয় মুছে ফেলা হয়েছে' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'মুছতে ব্যর্থ', message: err.message });
    } finally {
      setDeletingIncome(null);
    }
  };

  const filteredIncomes = incomes?.filter((inc) => {
    const term = search.toLowerCase();
    return inc.title.toLowerCase().includes(term) || inc.category.toLowerCase().includes(term);
  });

  const totalOtherIncomeSum = filteredIncomes?.reduce((sum, i) => sum + i.amount, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">অন্যান্য আয় (Other Income)</h1>
          <p className="text-xs text-slate-500">ডেলিভারি চার্জ ও সাধারণ বিক্রয়ের বাইরের অতিরিক্ত আয়</p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-press flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ নতুন আয়</span>
        </button>
      </div>

      {/* Summary Banner */}
      <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-blue-900">মোট অন্যান্য আয়:</span>
          <div className="text-xl font-black text-blue-800">{formatBDT(totalOtherIncomeSum, lang)}</div>
          <span className="text-[11px] text-blue-600">খাবার বিক্রি বাদে অন্যান্য উৎস থেকে আয়</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
          <PlusCircle className="w-5 h-5" />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="আয়ের বিবরণ খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        />
      </div>

      {/* Income List */}
      <div className="space-y-2">
        {filteredIncomes?.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 text-sm">
            কোনো অতিরিক্ত আয়ের তথ্য নেই
          </div>
        ) : (
          filteredIncomes?.map((inc) => (
            <div
              key={inc.id}
              className="p-3.5 rounded-2xl border bg-white shadow-xs hover:border-blue-300 transition-all flex items-center justify-between"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-sm text-slate-800 truncate">{inc.title}</h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800">
                    {inc.category}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  <span>{formatDisplayDateTime(inc.date, inc.time, lang)}</span>
                </div>
                {inc.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{inc.description}</p>}
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <span className="text-base font-black text-blue-700">{formatBDT(inc.amount, lang)}</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(inc)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingIncome(inc)}
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIncome ? 'আয় সম্পাদনা' : 'নতুন আয় যোগ করুন'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveIncome} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">আয়ের শিরোনাম</label>
            <input
              type="text"
              placeholder="যেমন: হোম ডেলিভারি চার্জ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
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
              <option value="Delivery Charges">ডেলিভারি চার্জ</option>
              <option value="Scrap Sale">কার্টন / পুরনো জিনিস বিক্রয়</option>
              <option value="Catering Advance">অর্ডার অগ্রিম</option>
              <option value="Miscellaneous">অন্যান্য বিবিধ আয়</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">টাকার পরিমাণ (৳)</label>
            <input
              type="number"
              min="1"
              value={amount || ''}
              onChange={(e) => setAmount(parseBDT(e.target.value))}
              className="w-full px-3 py-2 text-lg font-black text-blue-700 rounded-lg border border-slate-300 text-right focus:outline-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">বিবরণ (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="অতিরিক্ত তথ্য"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            {editingIncome ? 'পরিবর্তন সংরক্ষণ করুন' : 'আয় সংরক্ষণ করুন'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deletingIncome}
        onClose={() => setDeletingIncome(null)}
        onConfirm={handleDeleteIncome}
        title="আয় মুছে ফেলা"
        message={`আপনি কি নিশ্চিত "${deletingIncome?.title}" (৳${deletingIncome?.amount}) মুছে ফেলতে চান?`}
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
      />
    </div>
  );
};
