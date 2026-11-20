import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { db, logAudit } from '../../db';
import type { Customer, Product } from '../../db/types';
import { formatBDT, parseBDT } from '../../utils/currency';
import { getDhakaDateString, getDhakaTimeString } from '../../utils/date';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { sound } from '../../utils/sound';
import { UserPlus, UserCheck, AlertCircle } from 'lucide-react';

interface QuickDueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickDueModal: React.FC<QuickDueModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { lang } = useSettings();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      db.customers.toArray().then(setCustomers);
      db.products.filter((p) => p.isAvailable).toArray().then((prods) => {
        setProducts(prods);
        if (prods.length > 0) {
          setSelectedProductId(prods[0].id);
          setItemDescription(lang === 'bn' ? prods[0].nameBn || prods[0].name : prods[0].name);
          setUnitPrice(prods[0].sellingPrice);
        }
      });
    }
  }, [isOpen, lang]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setItemDescription(lang === 'bn' ? prod.nameBn || prod.name : prod.name);
      setUnitPrice(prod.sellingPrice);
    }
  };

  const totalAmount = Math.round(quantity * unitPrice);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      showToast({ type: 'error', title: 'টাকার পরিমাণ শূন্য হতে পারবে না' });
      return;
    }

    setIsSubmitting(true);
    try {
      let customerId = selectedCustomerId;
      let customerName = '';
      let customerMobile = '';

      if (isCreatingCustomer) {
        if (!newCustomerName.trim()) {
          showToast({ type: 'error', title: 'ক্রেতার নাম লিখুন' });
          setIsSubmitting(false);
          return;
        }
        customerId = crypto.randomUUID();
        customerName = newCustomerName.trim();
        customerMobile = newCustomerMobile.trim();
        const now = Date.now();
        const todayStr = getDhakaDateString();

        await db.customers.add({
          id: customerId,
          name: customerName,
          mobile: customerMobile,
          totalDue: 0,
          totalPaid: 0,
          currentBalance: 0,
          registrationDate: todayStr,
          createdAt: now,
          updatedAt: now
        });
      } else {
        const found = customers.find((c) => c.id === customerId);
        if (!found) {
          showToast({ type: 'error', title: 'অনুগ্রহ করে একজন ক্রেতা নির্বাচন করুন' });
          setIsSubmitting(false);
          return;
        }
        customerName = found.name;
        customerMobile = found.mobile;
      }

      const today = getDhakaDateString();
      const time = getDhakaTimeString();
      const now = Date.now();
      const saleId = crypto.randomUUID();
      const saleNumber = `DUE-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      // Execute in Dexie Transaction
      await db.transaction('rw', [db.sales, db.saleItems, db.customers, db.customerLedger], async () => {
        const prod = products.find((p) => p.id === selectedProductId);
        const costPrice = prod ? prod.costPrice : 0;

        // 1. Create Sale
        await db.sales.add({
          id: saleId,
          saleNumber,
          totalAmount,
          discountAmount: 0,
          payableAmount: totalAmount,
          paidAmount: 0,
          dueAmount: totalAmount,
          paymentMethod: 'due',
          customerId,
          customerName,
          customerMobile,
          status: 'completed',
          date: today,
          time,
          timestamp: now,
          notes: notes || `বাকি বিক্রি: ${itemDescription}`
        });

        // 2. Create SaleItem
        await db.saleItems.add({
          id: crypto.randomUUID(),
          saleId,
          productId: selectedProductId || 'custom',
          productName: itemDescription,
          productNameBn: itemDescription,
          quantity,
          unitCostPrice: costPrice,
          unitSellingPrice: unitPrice,
          subtotalCost: costPrice * quantity,
          subtotalSelling: totalAmount
        });

        // 3. Update Customer Balance
        const customer = await db.customers.get(customerId);
        if (customer) {
          const newBalance = customer.currentBalance + totalAmount;
          await db.customers.update(customerId, {
            totalDue: customer.totalDue + totalAmount,
            currentBalance: newBalance,
            updatedAt: now
          });

          // 4. Create Customer Ledger Debit Entry
          await db.customerLedger.add({
            id: crypto.randomUUID(),
            customerId,
            date: today,
            time,
            timestamp: now,
            type: 'debit',
            description: `${itemDescription} x ${quantity}`,
            debit: totalAmount,
            credit: 0,
            balance: newBalance,
            saleId,
            notes
          });
        }
      });

      await logAudit('CREATE', 'sale', saleId, `Due sale created for ${customerName}: ৳${totalAmount}`);
      sound.playSuccess();
      showToast({
        type: 'success',
        title: `বাকি বিক্রি সফল! (${formatBDT(totalAmount, lang)})`,
        message: `${customerName} এর বাকি খাতায় ৳${totalAmount} যোগ হয়েছে`
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast({ type: 'error', title: 'বাকি যোগ করতে সমস্যা হয়েছে', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="নতুন বাকি বিক্রি যোগ করুন" subtitle="ডিজিটাল বাকি খাতা">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Select / New Switch */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-700">ক্রেতা নির্বাচন</label>
            <button
              type="button"
              onClick={() => setIsCreatingCustomer(!isCreatingCustomer)}
              className="text-xs text-emerald-700 font-semibold hover:underline flex items-center space-x-1"
            >
              {isCreatingCustomer ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>তালিকা থেকে বাছুন</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ নতুন ক্রেতা</span>
                </>
              )}
            </button>
          </div>

          {isCreatingCustomer ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="ক্রেতার নাম (যেমন: রহিম ভাই)"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-emerald-600"
                required
              />
              <input
                type="tel"
                placeholder="মোবাইল নম্বর (ঐচ্ছিক)"
                value={newCustomerMobile}
                onChange={(e) => setNewCustomerMobile(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-emerald-600"
              />
            </div>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-emerald-600 font-medium"
              required
            >
              <option value="">-- ক্রেতা সিলেক্ট করুন --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.mobile ? `(${c.mobile})` : ''} - বর্তমান বাকি: ৳{c.currentBalance}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Product / Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">খাবার / আইটেম</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {lang === 'bn' ? p.nameBn || p.name : p.name} (৳{p.sellingPrice})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="আইটেমের নাম"
              className="px-3 py-2 text-xs rounded-lg border border-slate-300"
              required
            />
          </div>
        </div>

        {/* Quantity & Unit Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পরিমাণ (Quantity)</label>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 font-bold"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full text-center px-2 py-1.5 text-sm font-bold border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">একক মূল্য (৳)</label>
            <input
              type="number"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseBDT(e.target.value))}
              className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg text-right"
              required
            />
          </div>
        </div>

        {/* Total calculation preview */}
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
          <span className="text-xs font-bold text-rose-800">মোট বাকি পরিমাণ:</span>
          <span className="text-lg font-black text-rose-700">{formatBDT(totalAmount, lang)}</span>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
          <input
            type="text"
            placeholder="যেমন: সন্ধ্যায় পেমেন্ট করবে"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'বাকি নিশ্চিত করুন'}
        </button>
      </form>
    </Modal>
  );
};
