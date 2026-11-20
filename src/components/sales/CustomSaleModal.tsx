import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { db, logAudit } from '../../db';
import type { Product, Customer, PaymentMethod } from '../../db/types';
import { formatBDT, parseBDT } from '../../utils/currency';
import { getDhakaDateString, getDhakaTimeString } from '../../utils/date';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { sound } from '../../utils/sound';
import { Plus, Minus, Trash2 } from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CustomSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (saleId: string) => void;
}

export const CustomSaleModal: React.FC<CustomSaleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { lang } = useSettings();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      db.products.filter((p) => p.isAvailable).toArray().then(setProducts);
      db.customers.toArray().then(setCustomers);
      setCart([]);
      setSelectedCustomerId('');
      setDiscount(0);
      setPaidAmount(0);
      setPaymentMethod('cash');
      setNotes('');
    }
  }, [isOpen]);

  const addToCart = (product: Product) => {
    sound.playTap();
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id === productId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
  const payableAmount = Math.max(0, totalAmount - discount);
  const dueAmount = Math.max(0, payableAmount - paidAmount);

  // Auto-sync paid amount when payable amount changes if not due mode
  useEffect(() => {
    if (paymentMethod === 'due') {
      setPaidAmount(0);
    } else if (paidAmount === 0 || paidAmount > payableAmount) {
      setPaidAmount(payableAmount);
    }
  }, [payableAmount, paymentMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      showToast({ type: 'error', title: 'কার্টে কোনো আইটেম নেই' });
      return;
    }

    if (dueAmount > 0 && !selectedCustomerId) {
      showToast({ type: 'error', title: 'বাকি বিক্রির জন্য ক্রেতা সিলেক্ট করা আবশ্যক' });
      return;
    }

    setIsSubmitting(true);
    try {
      const today = getDhakaDateString();
      const time = getDhakaTimeString();
      const now = Date.now();
      const saleId = crypto.randomUUID();
      const saleNumber = `ORD-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      const customer = customers.find((c) => c.id === selectedCustomerId);

      await db.transaction(
        'rw',
        [db.sales, db.saleItems, db.customers, db.customerLedger, db.payments],
        async () => {
          // 1. Create Sale
          await db.sales.add({
            id: saleId,
            saleNumber,
            totalAmount,
            discountAmount: discount,
            payableAmount,
            paidAmount,
            dueAmount,
            paymentMethod,
            customerId: customer?.id,
            customerName: customer?.name,
            customerMobile: customer?.mobile,
            status: 'completed',
            date: today,
            time,
            timestamp: now,
            notes
          });

          // 2. Create SaleItems
          for (const item of cart) {
            await db.saleItems.add({
              id: crypto.randomUUID(),
              saleId,
              productId: item.product.id,
              productName: item.product.name,
              productNameBn: item.product.nameBn,
              quantity: item.quantity,
              unitCostPrice: item.product.costPrice,
              unitSellingPrice: item.product.sellingPrice,
              subtotalCost: item.product.costPrice * item.quantity,
              subtotalSelling: item.product.sellingPrice * item.quantity
            });
          }

          // 3. Create Payment record for cash received
          if (paidAmount > 0) {
            await db.payments.add({
              id: crypto.randomUUID(),
              paymentNumber: `PAY-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
              customerId: customer?.id,
              customerName: customer?.name,
              saleId,
              amount: paidAmount,
              paymentMethod: paymentMethod === 'due' ? 'cash' : (paymentMethod as any),
              paymentType: 'sale',
              date: today,
              time,
              timestamp: now,
              notes: `Order ${saleNumber}`
            });
          }

          // 4. Update Customer Ledger if due
          if (dueAmount > 0 && customer) {
            const newBalance = customer.currentBalance + dueAmount;
            await db.customers.update(customer.id, {
              totalDue: customer.totalDue + dueAmount,
              currentBalance: newBalance,
              updatedAt: now
            });

            await db.customerLedger.add({
              id: crypto.randomUUID(),
              customerId: customer.id,
              date: today,
              time,
              timestamp: now,
              type: 'debit',
              description: `অর্ডার ${saleNumber} (মোট: ৳${payableAmount}, জমা: ৳${paidAmount})`,
              debit: dueAmount,
              credit: 0,
              balance: newBalance,
              saleId,
              notes
            });
          }
        }
      );

      await logAudit('CREATE', 'sale', saleId, `Multi-item sale created ${saleNumber}: ৳${payableAmount}`);
      sound.playSuccess();
      showToast({
        type: 'success',
        title: `অর্ডার সম্পন্ন হয়েছে (${formatBDT(payableAmount, lang)})`,
        message: `ভাউচার: ${saleNumber}`
      });

      onSuccess?.(saleId);
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', title: 'অর্ডার সেভ করতে সমস্যা হয়েছে', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="কাস্টম অর্ডার ও বিলিং" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Picker Horizontal Slider / Grid */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">পণ্য সিলেক্ট করুন (ট্যাপ করুন):</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="p-2 bg-white rounded-lg border border-slate-200 hover:border-emerald-500 text-left active:scale-95 transition-all text-xs"
              >
                <div className="font-bold truncate">{lang === 'bn' ? p.nameBn || p.name : p.name}</div>
                <div className="text-emerald-700 font-bold">{formatBDT(p.sellingPrice, lang)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart Items Table */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">অর্ডার তালিকা ({cart.length} আইটেম):</label>
          {cart.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
              উপরের খাবারগুলোতে ট্যাপ করে কার্টে যোগ করুন
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-bold truncate text-slate-800">
                      {lang === 'bn' ? item.product.nameBn || item.product.name : item.product.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      @{formatBDT(item.product.sellingPrice, lang)} = {formatBDT(item.product.sellingPrice * item.quantity, lang)}
                    </div>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold w-5 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      className="p-1 text-rose-500 hover:text-rose-700 ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ক্রেতা (বাকি হলে বাধ্যতামূলক)</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- সাধারণ ক্রেতা (নগদ) --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.mobile ? `(${c.mobile})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পেমেন্ট মাধ্যম</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
            >
              <option value="cash">নগদ (Cash)</option>
              <option value="bkash">বিকাশ (bKash)</option>
              <option value="nagad">নগদ (Nagad)</option>
              <option value="due">সম্পূর্ণ বাকি (Due)</option>
              <option value="split">আংশিক জমা / বাকি</option>
            </select>
          </div>
        </div>

        {/* Discount & Paid Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ছাড় / ডিসকাউন্ট (৳)</label>
            <input
              type="number"
              min="0"
              value={discount || ''}
              onChange={(e) => setDiscount(parseBDT(e.target.value))}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg text-right"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">নগদ গ্রহণ (৳)</label>
            <input
              type="number"
              min="0"
              value={paidAmount || ''}
              onChange={(e) => setPaidAmount(parseBDT(e.target.value))}
              disabled={paymentMethod === 'due'}
              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg text-right text-emerald-700"
              placeholder="0"
            />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
          <div className="flex justify-between">
            <span>মোট বিল:</span>
            <span className="font-bold">{formatBDT(totalAmount, lang)}</span>
          </div>
          <div className="flex justify-between text-sm font-black border-t border-emerald-200 pt-1">
            <span>পরিশোধযোগ্য বিল:</span>
            <span className="text-emerald-800">{formatBDT(payableAmount, lang)}</span>
          </div>
          {dueAmount > 0 && (
            <div className="flex justify-between font-bold text-rose-700">
              <span>বাকি থাকবে:</span>
              <span>{formatBDT(dueAmount, lang)}</span>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || cart.length === 0}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
        >
          {isSubmitting ? 'অর্ডার প্রসেস হচ্ছে...' : `অর্ডার নিশ্চিত করুন (${formatBDT(payableAmount, lang)})`}
        </button>
      </form>
    </Modal>
  );
};
