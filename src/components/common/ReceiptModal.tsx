import React, { useRef } from 'react';
import { Printer, Share2, Download, CheckCircle, X } from 'lucide-react';
import { Modal } from './Modal';
import type { Sale, SaleItem } from '../../db/types';
import { formatBDT } from '../../utils/currency';
import { formatDisplayDateTime } from '../../utils/date';
import { useSettings } from '../../context/SettingsContext';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  items: SaleItem[];
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, sale, items }) => {
  const { settings, lang } = useSettings();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const lines = [
      `*${settings.shopNameBn || settings.shopName}*`,
      `রসিদ নং: ${sale.saleNumber}`,
      `তারিখ: ${formatDisplayDateTime(sale.date, sale.time, lang)}`,
      `------------------------`
    ];

    items.forEach((item) => {
      lines.push(`${item.productNameBn || item.productName} x ${item.quantity} = ${formatBDT(item.subtotalSelling, lang)}`);
    });

    lines.push(`------------------------`);
    lines.push(`*মোট বিল:* ${formatBDT(sale.totalAmount, lang)}`);
    if (sale.discountAmount > 0) {
      lines.push(`ডিসকাউন্ট: -${formatBDT(sale.discountAmount, lang)}`);
      lines.push(`পরিশোধযোগ্য: ${formatBDT(sale.payableAmount, lang)}`);
    }
    lines.push(`পরিশোধ: ${formatBDT(sale.paidAmount, lang)} (${sale.paymentMethod})`);
    if (sale.dueAmount > 0) {
      lines.push(`*বাকি:* ${formatBDT(sale.dueAmount, lang)}`);
    }
    lines.push(`ধন্যবাদ! আবার আসবেন।`);

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${sale.customerMobile ? sale.customerMobile.replace(/[^0-9]/g, '') : ''}?text=${text}`, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ক্যাশ মেমো / রসিদ" subtitle={`ভাউচার: ${sale.saleNumber}`} maxWidth="sm">
      <div>
        {/* Printable Receipt Paper */}
        <div
          ref={receiptRef}
          id="receipt-paper"
          className="receipt-print bg-white p-4 rounded-xl border border-dashed border-slate-300 font-mono text-xs text-slate-800 shadow-inner space-y-3"
        >
          {/* Shop Header */}
          <div className="text-center border-b border-slate-200 pb-2">
            <h2 className="font-bold text-base font-sans text-emerald-800">
              {lang === 'bn' ? settings.shopNameBn : settings.shopName}
            </h2>
            <p className="text-[11px] text-slate-600">{settings.address}</p>
            <p className="text-[11px] text-slate-600">মোবাইল: {settings.mobile}</p>
          </div>

          {/* Sale Info */}
          <div className="text-[11px] flex justify-between border-b border-slate-100 pb-1.5 text-slate-600">
            <div>
              <div>নং: <span className="font-bold text-slate-800">{sale.saleNumber}</span></div>
              {sale.customerName && <div>ক্রেতা: <span className="font-bold text-slate-800">{sale.customerName}</span></div>}
            </div>
            <div className="text-right">
              <div>{formatDisplayDateTime(sale.date, sale.time, lang)}</div>
              <div>পদ্ধতি: <span className="font-bold uppercase text-slate-800">{sale.paymentMethod}</span></div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600">
                <th className="py-1">আইটেম</th>
                <th className="py-1 text-center">পরিমাণ</th>
                <th className="py-1 text-right">মূল্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1 pr-1 font-medium text-slate-800">
                    {item.productNameBn || item.productName}
                    <span className="block text-[10px] text-slate-500 font-normal">
                      @{formatBDT(item.unitSellingPrice, lang)}
                    </span>
                  </td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right font-semibold">{formatBDT(item.subtotalSelling, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Totals */}
          <div className="border-t border-slate-300 pt-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>মোট মূল্য:</span>
              <span className="font-semibold">{formatBDT(sale.totalAmount, lang)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>ডিসকাউন্ট:</span>
                <span>-{formatBDT(sale.discountAmount, lang)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-1">
              <span>পরিশোধযোগ্য:</span>
              <span className="text-emerald-700">{formatBDT(sale.payableAmount, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span>নগদ জমা:</span>
              <span className="font-bold text-slate-800">{formatBDT(sale.paidAmount, lang)}</span>
            </div>
            {sale.dueAmount > 0 && (
              <div className="flex justify-between font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                <span>অবশিষ্ট বাকি:</span>
                <span>{formatBDT(sale.dueAmount, lang)}</span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center text-[11px] text-slate-500 border-t border-slate-200 pt-2">
            <div>ধন্যবাদ! আবার আসবেন।</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Powered by Sabbir POS (Offline)</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex space-x-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 active:scale-95 transition-all shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট রসিদ</span>
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow-md"
          >
            <Share2 className="w-4 h-4" />
            <span>হোয়াটসঅ্যাপ</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
