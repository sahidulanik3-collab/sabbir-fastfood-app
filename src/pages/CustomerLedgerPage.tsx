import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logAudit } from '../db';
import type { Customer, CustomerLedger, PaymentMethod } from '../db/types';
import { formatBDT, parseBDT } from '../utils/currency';
import { getDhakaDateString, getDhakaTimeString, formatDisplayDateTime, formatDisplayDate } from '../utils/date';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { sound } from '../utils/sound';
import { Modal } from '../components/common/Modal';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Share2,
  FileSpreadsheet,
  AlertCircle,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { exportToExcel } from '../utils/export';

export const CustomerLedgerPage: React.FC = () => {
  const { lang, t } = useSettings();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Registration Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNotes, setCustNotes] = useState('');

  // Add Due Modal State
  const [isAddDueOpen, setIsAddDueOpen] = useState(false);
  const [dueItemName, setDueItemName] = useState('');
  const [dueQty, setDueQty] = useState(1);
  const [dueUnitPrice, setDueUnitPrice] = useState<number>(0);
  const [dueTotal, setDueTotal] = useState<number>(0);
  const [dueNotes, setDueNotes] = useState('');

  // Receive Payment Modal State
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState('');

  const customers = useLiveQuery(() => db.customers.toArray(), []);

  // Ledger history for selected customer
  const ledgerHistory = useLiveQuery<CustomerLedger[]>(
    () =>
      selectedCustomer
        ? db.customerLedger
            .where('customerId')
            .equals(selectedCustomer.id)
            .sortBy('timestamp')
            .then((items) => items.reverse())
        : Promise.resolve([] as CustomerLedger[]),
    [selectedCustomer]
  );

  // Register new customer
  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      showToast({ type: 'error', title: 'ক্রেতার নাম আবশ্যক' });
      return;
    }

    try {
      const now = Date.now();
      const id = crypto.randomUUID();
      const newCustomer: Customer = {
        id,
        name: custName.trim(),
        mobile: custMobile.trim(),
        address: custAddress.trim() || undefined,
        notes: custNotes.trim() || undefined,
        totalDue: 0,
        totalPaid: 0,
        currentBalance: 0,
        registrationDate: getDhakaDateString(),
        createdAt: now,
        updatedAt: now
      };

      await db.customers.add(newCustomer);
      await logAudit('CREATE', 'customer', id, `Registered customer: ${custName}`);
      showToast({ type: 'success', title: 'ক্রেতা সফলভাবে নিবন্ধিত হয়েছে' });

      setIsRegisterOpen(false);
      setCustName('');
      setCustMobile('');
      setCustAddress('');
      setCustNotes('');
      setSelectedCustomer(newCustomer);
    } catch (err: any) {
      showToast({ type: 'error', title: 'নিবন্ধন ব্যর্থ', message: err.message });
    }
  };

  // Add Due to Customer
  const handleSaveDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const finalAmount = dueTotal > 0 ? dueTotal : dueQty * dueUnitPrice;
    if (finalAmount <= 0) {
      showToast({ type: 'error', title: 'টাকার পরিমাণ লিখুন' });
      return;
    }

    try {
      const today = getDhakaDateString();
      const time = getDhakaTimeString();
      const now = Date.now();
      const saleId = crypto.randomUUID();
      const saleNumber = `DUE-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      await db.transaction('rw', [db.sales, db.saleItems, db.customers, db.customerLedger], async () => {
        // 1. Create Sale
        await db.sales.add({
          id: saleId,
          saleNumber,
          totalAmount: finalAmount,
          discountAmount: 0,
          payableAmount: finalAmount,
          paidAmount: 0,
          dueAmount: finalAmount,
          paymentMethod: 'due',
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          customerMobile: selectedCustomer.mobile,
          status: 'completed',
          date: today,
          time,
          timestamp: now,
          notes: dueNotes || dueItemName
        });

        // 2. Create SaleItem
        await db.saleItems.add({
          id: crypto.randomUUID(),
          saleId,
          productId: 'custom-due',
          productName: dueItemName || 'খাবার বাকি',
          quantity: dueQty,
          unitCostPrice: 0,
          unitSellingPrice: dueUnitPrice || finalAmount,
          subtotalCost: 0,
          subtotalSelling: finalAmount
        });

        // 3. Update Customer Balance
        const freshCustomer = await db.customers.get(selectedCustomer.id);
        const newBalance = (freshCustomer?.currentBalance || 0) + finalAmount;
        await db.customers.update(selectedCustomer.id, {
          totalDue: (freshCustomer?.totalDue || 0) + finalAmount,
          currentBalance: newBalance,
          updatedAt: now
        });

        // 4. Ledger Debit
        await db.customerLedger.add({
          id: crypto.randomUUID(),
          customerId: selectedCustomer.id,
          date: today,
          time,
          timestamp: now,
          type: 'debit',
          description: `${dueItemName || 'খাবার'} x ${dueQty}`,
          debit: finalAmount,
          credit: 0,
          balance: newBalance,
          saleId,
          notes: dueNotes
        });

        setSelectedCustomer({
          ...selectedCustomer,
          totalDue: (freshCustomer?.totalDue || 0) + finalAmount,
          currentBalance: newBalance
        });
      });

      await logAudit('CREATE', 'sale', saleId, `Added due ৳${finalAmount} to ${selectedCustomer.name}`);
      sound.playSuccess();
      showToast({ type: 'success', title: `৳${finalAmount} বাকি যোগ হয়েছে` });
      setIsAddDueOpen(false);
      setDueItemName('');
      setDueUnitPrice(0);
      setDueTotal(0);
      setDueNotes('');
    } catch (err: any) {
      showToast({ type: 'error', title: 'বাকি যোগ করতে সমস্যা', message: err.message });
    }
  };

  // Receive Payment from Customer
  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (payAmount <= 0) {
      showToast({ type: 'error', title: 'পেমেন্টের পরিমাণ লিখুন' });
      return;
    }

    try {
      const today = getDhakaDateString();
      const time = getDhakaTimeString();
      const now = Date.now();
      const paymentId = crypto.randomUUID();
      const paymentNumber = `PAY-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      await db.transaction('rw', [db.payments, db.customers, db.customerLedger], async () => {
        // 1. Create Payment record
        await db.payments.add({
          id: paymentId,
          paymentNumber,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: payAmount,
          paymentMethod: payMethod === 'due' ? 'cash' : (payMethod as any),
          paymentType: 'due_collection',
          date: today,
          time,
          timestamp: now,
          notes: payNotes || 'বাকি আদায় (Due Collection)'
        });

        // 2. Update Customer Balance
        const freshCustomer = await db.customers.get(selectedCustomer.id);
        const newBalance = Math.max(0, (freshCustomer?.currentBalance || 0) - payAmount);
        await db.customers.update(selectedCustomer.id, {
          totalPaid: (freshCustomer?.totalPaid || 0) + payAmount,
          currentBalance: newBalance,
          updatedAt: now
        });

        // 3. Ledger Credit
        await db.customerLedger.add({
          id: crypto.randomUUID(),
          customerId: selectedCustomer.id,
          date: today,
          time,
          timestamp: now,
          type: 'credit',
          description: `বাকি পরিশোধ (${payMethod.toUpperCase()})`,
          debit: 0,
          credit: payAmount,
          balance: newBalance,
          paymentId,
          notes: payNotes
        });

        setSelectedCustomer({
          ...selectedCustomer,
          totalPaid: (freshCustomer?.totalPaid || 0) + payAmount,
          currentBalance: newBalance
        });
      });

      await logAudit('CREATE', 'payment', paymentId, `Due payment ৳${payAmount} received from ${selectedCustomer.name}`);
      sound.playSuccess();
      showToast({
        type: 'success',
        title: `৳${payAmount} পেমেন্ট জমা হয়েছে`,
        message: `অবশিষ্ট বাকি: ${formatBDT(Math.max(0, selectedCustomer.currentBalance - payAmount), lang)}`
      });
      setIsPayOpen(false);
      setPayAmount(0);
      setPayNotes('');
    } catch (err: any) {
      showToast({ type: 'error', title: 'পেমেন্ট নিতে ব্যর্থ', message: err.message });
    }
  };

  // WhatsApp Reminder message generator
  const handleWhatsAppShare = () => {
    if (!selectedCustomer) return;
    const msg = [
      `আসসালামু আলাইকুম, ${selectedCustomer.name} ভাই।`,
      `*সাব্বির ফাস্ট ফুড* থেকে আপনার হিসাব বিবরণী:`,
      `------------------------`,
      `মোট বাকি নেওয়া: ${formatBDT(selectedCustomer.totalDue, lang)}`,
      `মোট পরিশোধ করেছেন: ${formatBDT(selectedCustomer.totalPaid, lang)}`,
      `*বর্তমান বকেয়া বাকি: ${formatBDT(selectedCustomer.currentBalance, lang)}*`,
      `------------------------`,
      `অনুগ্রহ করে সময়মতো বকেয়া পরিশোধ করার জন্য বিনীত অনুরোধ করা হলো।`,
      `ধন্যবাদ!`
    ].join('\n');

    const cleanNum = selectedCustomer.mobile ? selectedCustomer.mobile.replace(/[^0-9]/g, '') : '';
    window.open(`https://wa.me/${cleanNum}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Export Customer Ledger to Excel
  const handleExportCustomerExcel = () => {
    if (!selectedCustomer || !ledgerHistory?.length) return;
    const data = ledgerHistory.map((h) => ({
      'Date': h.date,
      'Time': h.time,
      'Description': h.description,
      'Debit (Due Created)': h.debit,
      'Credit (Paid)': h.credit,
      'Remaining Balance': h.balance,
      'Notes': h.notes || ''
    }));

    exportToExcel(
      [{ sheetName: 'Ledger History', data }],
      `ledger-${selectedCustomer.name.replace(/\s+/g, '-')}-${getDhakaDateString()}`
    );
    showToast({ type: 'success', title: 'খাতার এক্সেল ফাইল ডাউনলোড হয়েছে' });
  };

  const filteredCustomers = customers?.filter((c) => {
    const term = search.toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.mobile && c.mobile.includes(term));
  });

  const totalOutstandingDue = customers?.reduce((sum, c) => sum + c.currentBalance, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">বাকি খাতা (Digital Baki Khata)</h1>
          <p className="text-xs text-slate-500">গ্রাহকদের বকেয়া হিসাব ও জমা রেকর্ড</p>
        </div>
        <button
          onClick={() => setIsRegisterOpen(true)}
          className="btn-press flex items-center space-x-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ নতুন খাতা খুলুন</span>
        </button>
      </div>

      {/* Total Due Banner */}
      <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-rose-900">দোকানের মোট পাওনা বাকি:</span>
          <div className="text-2xl font-black text-rose-700">{formatBDT(totalOutstandingDue, lang)}</div>
          <span className="text-[11px] text-rose-600">{customers?.length || 0} জন ক্রেতা নিবন্ধিত</span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
          ৳
        </div>
      </div>

      {/* Main Split View or Mobile Drill-down */}
      {!selectedCustomer ? (
        /* Customer List View */
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            />
          </div>

          <div className="space-y-2">
            {filteredCustomers?.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 text-sm">
                কোনো ক্রেতার খাতা পাওয়া যায়নি। উপরে "+ নতুন খাতা খুলুন" বাটনে চাপুন।
              </div>
            ) : (
              filteredCustomers?.map((cust) => (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomer(cust)}
                  className="p-3.5 rounded-2xl border bg-white shadow-xs hover:border-rose-400 hover:shadow-md active:bg-slate-50 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-sm text-slate-800 truncate">{cust.name}</h3>
                      {cust.currentBalance > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                          বাকি আছে
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                      {cust.mobile && (
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{cust.mobile}</span>
                        </span>
                      )}
                      <span>নিবন্ধন: {cust.registrationDate}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="block text-xs text-slate-400 font-medium">বর্তমান বাকি</span>
                    <span
                      className={`text-base font-black ${
                        cust.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatBDT(cust.currentBalance, lang)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Selected Customer Individual Ledger Detail View */
        <div className="space-y-4 animate-in fade-in">
          {/* Back button & Customer Header */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1 bg-slate-100 px-2.5 py-1.5 rounded-lg active:scale-95"
              >
                <span>← সকল ক্রেতা তালিকা</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportCustomerExcel}
                  className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg text-xs flex items-center space-x-1"
                  title="এক্সেল ডাউনলোড"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>এক্সেল</span>
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  className="p-1.5 text-emerald-700 hover:text-emerald-800 bg-emerald-50 rounded-lg text-xs font-bold flex items-center space-x-1"
                  title="WhatsApp এ বাকি তাগাদা মেসেজ পাঠান"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>তাগাদা</span>
                </button>
              </div>
            </div>

            {/* Customer Details */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800">{selectedCustomer.name}</h2>
                {selectedCustomer.mobile && (
                  <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{selectedCustomer.mobile}</span>
                  </p>
                )}
                {selectedCustomer.address && (
                  <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{selectedCustomer.address}</span>
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500 font-semibold">বকেয়া বাকি:</span>
                <div className="text-xl font-black text-rose-600">
                  {formatBDT(selectedCustomer.currentBalance, lang)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  মোট ক্রয়: {formatBDT(selectedCustomer.totalDue, lang)} | জমা: {formatBDT(selectedCustomer.totalPaid, lang)}
                </div>
              </div>
            </div>

            {/* Action buttons: Add Due & Receive Payment */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setDueItemName('');
                  setDueQty(1);
                  setDueUnitPrice(0);
                  setDueTotal(0);
                  setIsAddDueOpen(true);
                }}
                className="btn-press py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md active:scale-95 transition-all"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ খাবার বাকি দিন</span>
              </button>
              <button
                onClick={() => {
                  setPayAmount(selectedCustomer.currentBalance);
                  setIsPayOpen(true);
                }}
                className="btn-press py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md active:scale-95 transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>+ টাকা জমা নিন</span>
              </button>
            </div>
          </div>

          {/* Customer Ledger History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
              <span>খাতার লেনদেন ইতিহাস</span>
              <span className="text-[11px] font-normal text-slate-500">মোট লেনদেন: {ledgerHistory?.length || 0}টি</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold">
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3">বিবরণ</th>
                    <th className="py-2.5 px-3 text-right text-rose-700">বাকি (Debit)</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700">জমা (Credit)</th>
                    <th className="py-2.5 px-3 text-right">ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerHistory?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        এই খাতায় এখনো কোনো লেনদেন হয়নি
                      </td>
                    </tr>
                  ) : (
                    ledgerHistory?.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{row.description}</div>
                          {row.notes && <div className="text-[10px] text-slate-400">{row.notes}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                          {row.debit > 0 ? formatBDT(row.debit, lang) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                          {row.credit > 0 ? formatBDT(row.credit, lang) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-800">
                          {formatBDT(row.balance, lang)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer Registration Modal */}
      <Modal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} title="নতুন খাতা নিবন্ধন">
        <form onSubmit={handleRegisterCustomer} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ক্রেতার নাম *</label>
            <input
              type="text"
              placeholder="যেমন: মোঃ রহিম উদ্দিন"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-rose-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মোবাইল নম্বর (ঐচ্ছিক)</label>
            <input
              type="tel"
              placeholder="01XXXXXXXXX"
              value={custMobile}
              onChange={(e) => setCustMobile(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-rose-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ঠিকানা / পরিচিতি (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="যেমন: স্থানীয় দোকানদার / ছাত্র"
              value={custAddress}
              onChange={(e) => setCustAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="বিশেষ কোনো নোট"
              value={custNotes}
              onChange={(e) => setCustNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            খাতা খুলুন
          </button>
        </form>
      </Modal>

      {/* Add Due Modal */}
      <Modal
        isOpen={isAddDueOpen}
        onClose={() => setIsAddDueOpen(false)}
        title="খাবার বাকি লিখুন"
        subtitle={`ক্রেতা: ${selectedCustomer?.name}`}
      >
        <form onSubmit={handleSaveDue} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">খাবার / আইটেমের বিবরণ</label>
            <input
              type="text"
              placeholder="যেমন: বার্গার ২টি, পাস্তা ১টি"
              value={dueItemName}
              onChange={(e) => setDueItemName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পরিমাণ</label>
              <input
                type="number"
                min="1"
                value={dueQty}
                onChange={(e) => setDueQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">মোট বাকি টাকা (৳)</label>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={dueTotal || ''}
                onChange={(e) => setDueTotal(parseBDT(e.target.value))}
                className="w-full px-3 py-2 text-lg font-black text-rose-700 border border-slate-300 rounded-lg text-right"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="যেমন: সন্ধ্যায় টাকা দিবে"
              value={dueNotes}
              onChange={(e) => setDueNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            বাকি সংরক্ষণ করুন
          </button>
        </form>
      </Modal>

      {/* Receive Payment Modal */}
      <Modal
        isOpen={isPayOpen}
        onClose={() => setIsPayOpen(false)}
        title="বাকি টাকা জমা নিন"
        subtitle={`ক্রেতা: ${selectedCustomer?.name} (বকেয়া: ${formatBDT(selectedCustomer?.currentBalance, lang)})`}
      >
        <form onSubmit={handleReceivePayment} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">জমা টাকার পরিমাণ (৳)</label>
            <input
              type="number"
              min="1"
              value={payAmount || ''}
              onChange={(e) => setPayAmount(parseBDT(e.target.value))}
              className="w-full px-3 py-2 text-xl font-black text-emerald-700 border border-slate-300 rounded-lg text-right"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">পেমেন্ট মাধ্যম</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white font-medium"
            >
              <option value="cash">নগদ (Cash)</option>
              <option value="bkash">বিকাশ (bKash)</option>
              <option value="nagad">নগদ (Nagad)</option>
              <option value="other">অন্যান্য</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মন্তব্য (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="যেমন: বিকাশ ট্রানজেকশন আইডি বা নোট"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>

          {/* Remaining calculation preview */}
          {selectedCustomer && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex justify-between">
              <span>পরিশোধের পর অবশিষ্ট বাকি:</span>
              <span className="font-bold text-slate-800">
                {formatBDT(Math.max(0, selectedCustomer.currentBalance - payAmount), lang)}
              </span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            পেমেন্ট জমা নিশ্চিত করুন
          </button>
        </form>
      </Modal>
    </div>
  );
};
