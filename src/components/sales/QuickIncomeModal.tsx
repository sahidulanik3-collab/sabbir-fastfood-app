import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { db, logAudit } from '../../db';
import { formatBDT, parseBDT } from '../../utils/currency';
import { getDhakaDateString, getDhakaTimeString } from '../../utils/date';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { sound } from '../../utils/sound';

interface QuickIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickIncomeModal: React.FC<QuickIncomeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { lang } = useSettings();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Delivery Charges');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      showToast({ type: 'error', title: 'টাকার পরিমাণ লিখুন' });
      return;
    }
    if (!title.trim()) {
      showToast({ type: 'error', title: 'আয়ের শিরোনাম লিখুন' });
      return;
    }

    setIsSubmitting(true);
    try {
      const today = getDhakaDateString();
      const time = getDhakaTimeString();
      const now = Date.now();
      const incomeId = crypto.randomUUID();
      const incomeNumber = `INC-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      await db.otherIncome.add({
        id: incomeId,
        incomeNumber,
        title: title.trim(),
        category,
        amount,
        date: today,
        time,
        timestamp: now,
        description: description.trim() || undefined
      });

      await logAudit('CREATE', 'closing', incomeId, `Other income added: ${title} (${formatBDT(amount, 'en')})`);
      sound.playSuccess();
      showToast({
        type: 'success',
        title: `অন্যান্য আয় যোগ হয়েছে (${formatBDT(amount, lang)})`,
        message: `${title} - ৳${amount}`
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'আয় সংরক্ষণ করতে সমস্যা হয়েছে', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="অন্যান্য আয় যোগ করুন" subtitle="ডেলিভারি চার্জ বা অতিরিক্ত ব্যবসা আয়">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">আয়ের শিরোনাম</label>
          <input
            type="text"
            placeholder="যেমন: হোম ডেলিভারি চার্জ, বাতিল কার্টন বিক্রয়"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-blue-600"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
          >
            <option value="Delivery Charges">হোম ডেলিভারি চার্জ (Delivery)</option>
            <option value="Scrap Sale">পুরনো জিনিস / কার্টন বিক্রি</option>
            <option value="Catering Advance">অর্ডার অগ্রিম</option>
            <option value="Miscellaneous">অন্যান্য বিবিধ আয়</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">টাকার পরিমাণ (BDT ৳)</label>
          <input
            type="number"
            min="1"
            placeholder="0"
            value={amount || ''}
            onChange={(e) => setAmount(parseBDT(e.target.value))}
            className="w-full px-3 py-2 text-lg font-black text-blue-700 rounded-lg border border-slate-300 text-right focus:outline-blue-600"
            required
          />
        </div>

        {/* Description */}
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'আয় সংরক্ষণ করুন'}
        </button>
      </form>
    </Modal>
  );
};
