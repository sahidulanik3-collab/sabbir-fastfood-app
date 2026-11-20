import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { db, logAudit } from '../../db';
import type { ExpenseCategory } from '../../db/types';
import { formatBDT, parseBDT } from '../../utils/currency';
import { getDhakaDateString, getDhakaTimeString } from '../../utils/date';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { sound } from '../../utils/sound';

interface QuickExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickExpenseModal: React.FC<QuickExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { lang } = useSettings();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Gas Cylinder');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('pcs');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      db.expenseCategories.toArray().then((cats) => {
        setCategories(cats);
        if (cats.length > 0) {
          setCategory(cats[0].name);
        }
      });
      setTitle('');
      setQuantity('');
      setTotalAmount(0);
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      showToast({ type: 'error', title: 'খরচের পরিমাণ লিখুন' });
      return;
    }
    if (!title.trim()) {
      showToast({ type: 'error', title: 'খরচের নাম লিখুন' });
      return;
    }

    setIsSubmitting(true);
    try {
      const today = getDhakaDateString();
      const time = getDhakaTimeString();
      const now = Date.now();
      const expenseId = crypto.randomUUID();
      const expenseNumber = `EXP-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      await db.expenses.add({
        id: expenseId,
        expenseNumber,
        title: title.trim(),
        category,
        quantity: quantity ? parseFloat(quantity) : undefined,
        unit: quantity ? unit : undefined,
        totalAmount,
        date: today,
        time,
        timestamp: now,
        notes: notes.trim() || undefined
      });

      await logAudit('CREATE', 'expense', expenseId, `Expense recorded: ${title} (${formatBDT(totalAmount, 'en')})`);
      sound.playTap();
      showToast({
        type: 'success',
        title: `খরচ লিপিবদ্ধ হয়েছে (${formatBDT(totalAmount, lang)})`,
        message: `${title} - ৳${totalAmount}`
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'খরচ সেভ করতে সমস্যা হয়েছে', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="নতুন খরচ যোগ করুন" subtitle="দৈনিক দোকান পরিচালন ব্যয়">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Title */}
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

        {/* Category */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">খরচের ক্যাটাগরি</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-amber-600"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {lang === 'bn' ? c.nameBn || c.name : c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quantity & Unit (Optional) */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পরিমাণ (ঐচ্ছিক)</label>
            <input
              type="number"
              step="any"
              placeholder="যেমন: ২.৫"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">একক (Unit)</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="pcs">টি / Pcs</option>
              <option value="kg">কেজি (Kg)</option>
              <option value="liter">লিটার (Liter)</option>
              <option value="cylinder">সিলিন্ডার (Cylinder)</option>
              <option value="packet">প্যাকেট (Packet)</option>
              <option value="month">মাস (Month)</option>
            </select>
          </div>
        </div>

        {/* Total Amount */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">মোট টাকা (BDT ৳)</label>
          <input
            type="number"
            min="1"
            placeholder="0"
            value={totalAmount || ''}
            onChange={(e) => setTotalAmount(parseBDT(e.target.value))}
            className="w-full px-3 py-2 text-lg font-black text-amber-700 rounded-lg border border-slate-300 text-right focus:outline-amber-600"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
          <input
            type="text"
            placeholder="অতিরিক্ত কোনো তথ্য"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'খরচ সংরক্ষণ করুন'}
        </button>
      </form>
    </Modal>
  );
};
