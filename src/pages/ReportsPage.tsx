import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatBDT } from '../utils/currency';
import { getDhakaDateString, getDateRange, formatDisplayDate } from '../utils/date';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { exportToExcel, generatePdfReport } from '../utils/export';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Printer,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  ShoppingBag,
  CreditCard,
  AlertCircle
} from 'lucide-react';

const PIE_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

export const ReportsPage: React.FC = () => {
  const { lang, settings, t } = useSettings();
  const { showToast } = useToast();

  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [customStart, setCustomStart] = useState(getDhakaDateString());
  const [customEnd, setCustomEnd] = useState(getDhakaDateString());

  // Determine active date range
  const { start, end } = (() => {
    if (period === 'daily') return getDateRange('today');
    if (period === 'weekly') return getDateRange('7days');
    if (period === 'monthly') return getDateRange('month');
    return { start: customStart, end: customEnd };
  })();

  // Fetch sales, sale items, payments, expenses, other income in date range
  const sales = useLiveQuery(
    () => db.sales.where('date').between(start, end, true, true).and((s) => !s.isReversed).toArray(),
    [start, end]
  );

  const saleItems = useLiveQuery(async () => {
    if (!sales?.length) return [];
    const saleIds = sales.map((s) => s.id);
    return db.saleItems.filter((item) => saleIds.includes(item.saleId)).toArray();
  }, [sales]);

  const payments = useLiveQuery(
    () => db.payments.where('date').between(start, end, true, true).toArray(),
    [start, end]
  );

  const expenses = useLiveQuery(
    () => db.expenses.where('date').between(start, end, true, true).toArray(),
    [start, end]
  );

  const otherIncome = useLiveQuery(
    () => db.otherIncome.where('date').between(start, end, true, true).toArray(),
    [start, end]
  );

  const allProducts = useLiveQuery(() => db.products.toArray(), []) || [];

  // Financial Calculations
  const totalSales = sales?.reduce((sum, s) => sum + s.payableAmount, 0) || 0;
  const totalCostOfGoods = saleItems?.reduce((sum, i) => sum + i.subtotalCost, 0) || 0;
  const totalItemsSold = saleItems?.reduce((sum, i) => sum + i.quantity, 0) || 0;
  const totalOrders = sales?.length || 0;

  // Payments & Cash Flow
  const totalCashReceived = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalDueCreated = sales?.reduce((sum, s) => sum + s.dueAmount, 0) || 0;
  const totalDueCollected =
    payments?.filter((p) => p.paymentType === 'due_collection').reduce((sum, p) => sum + p.amount, 0) || 0;

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.totalAmount, 0) || 0;
  const totalOtherIncome = otherIncome?.reduce((sum, i) => sum + i.amount, 0) || 0;

  // Exact Financial Formula:
  // Gross Profit = Total Sales - Cost of Goods Sold
  // Net Profit = Gross Profit - Operating Expenses + Other Income
  const grossProfit = totalSales - totalCostOfGoods;
  const netProfit = grossProfit - totalExpenses + totalOtherIncome;

  // Product-wise sales summary with icon and details (same as Home page)
  interface ItemStat {
    id: string;
    name: string;
    nameBn?: string;
    icon?: string;
    image?: string;
    quantity: number;
    revenue: number;
  }

  const productStats: Record<string, ItemStat> = {};

  // Seed with all available products so their icons & names match the Home page
  allProducts.forEach((p) => {
    productStats[p.id] = {
      id: p.id,
      name: p.name,
      nameBn: p.nameBn,
      icon: p.icon || '🍔',
      image: p.image,
      quantity: 0,
      revenue: 0
    };
  });

  // Accumulate sold items from sales in current period
  saleItems?.forEach((item) => {
    const key = item.productId;
    if (!productStats[key]) {
      productStats[key] = {
        id: key,
        name: item.productName,
        nameBn: item.productNameBn,
        icon: '🍔',
        quantity: 0,
        revenue: 0
      };
    }
    productStats[key].quantity += item.quantity;
    productStats[key].revenue += item.subtotalSelling;
  });

  // Sort by highest quantity sold
  const topProducts = Object.values(productStats).sort((a, b) => b.quantity - a.quantity);

  // Expense categories breakdown for charts
  const expenseCatStats: Record<string, number> = {};
  expenses?.forEach((e) => {
    expenseCatStats[e.category] = (expenseCatStats[e.category] || 0) + e.totalAmount;
  });
  const expenseChartData = Object.entries(expenseCatStats).map(([name, value]) => ({ name, value }));

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  // Export PDF Report
  const handleExportPDF = () => {
    const summaryRows: [string, string][] = [
      ['Total Sales Revenue', formatBDT(totalSales, 'en')],
      ['Cost of Goods Sold (COGS)', formatBDT(totalCostOfGoods, 'en')],
      ['Estimated Gross Profit', formatBDT(grossProfit, 'en')],
      ['Total Operating Expenses', formatBDT(totalExpenses, 'en')],
      ['Other Income', formatBDT(totalOtherIncome, 'en')],
      ['Estimated Net Profit', formatBDT(netProfit, 'en')],
      ['Total Cash Collected', formatBDT(totalCashReceived, 'en')],
      ['Due Created', formatBDT(totalDueCreated, 'en')],
      ['Due Collected', formatBDT(totalDueCollected, 'en')],
      ['Total Orders Count', `${totalOrders}`],
      ['Total Food Items Sold', `${totalItemsSold}`]
    ];

    const tableHead = ['Product Name', 'Sold Qty', 'Total Revenue'];
    const tableBody = topProducts.map((p) => [p.name, p.quantity, formatBDT(p.revenue, 'en')]);

    generatePdfReport({
      title: `${period.toUpperCase()} FINANCIAL REPORT`,
      shopName: settings.shopName || 'Sabbir Fast Food POS',
      dateRange: `${start} to ${end}`,
      summaryRows,
      tableHead,
      tableBody,
      filename: `financial-report-${period}-${start}-to-${end}`
    });

    showToast({ type: 'success', title: 'পিডিএফ রিপোর্ট তৈরি হয়েছে' });
  };

  // Export Excel Report with Multiple Sheets
  const handleExportExcel = () => {
    const summarySheet = [
      { Metric: 'Total Sales Revenue', Amount: totalSales },
      { Metric: 'Cost of Goods Sold (COGS)', Amount: totalCostOfGoods },
      { Metric: 'Gross Profit', Amount: grossProfit },
      { Metric: 'Operating Expenses', Amount: totalExpenses },
      { Metric: 'Other Income', Amount: totalOtherIncome },
      { Metric: 'Net Profit', Amount: netProfit },
      { Metric: 'Total Cash Collected', Amount: totalCashReceived },
      { Metric: 'Due Created', Amount: totalDueCreated },
      { Metric: 'Due Collected', Amount: totalDueCollected }
    ];

    const productsSheet = topProducts.map((p) => ({
      Product: p.name,
      'Quantity Sold': p.quantity,
      'Total Revenue (BDT)': p.revenue
    }));

    const expensesSheet = expenses?.map((e) => ({
      Voucher: e.expenseNumber,
      Title: e.title,
      Category: e.category,
      Amount: e.totalAmount,
      Date: e.date,
      Time: e.time
    })) || [];

    exportToExcel(
      [
        { sheetName: 'Executive Summary', data: summarySheet },
        { sheetName: 'Product Performance', data: productsSheet },
        { sheetName: 'Expenses Detail', data: expensesSheet }
      ],
      `full-report-${period}-${start}-to-${end}`
    );

    showToast({ type: 'success', title: 'মাল্টি-শীট এক্সেল ডাউনলোড হয়েছে' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">রিপোর্ট ও লাভ (Reports & Analytics)</h1>
          <p className="text-xs text-slate-500">আয়-ব্যয়, প্রকৃত লাভ ও ব্যবসায়িক পরিসংখ্যান</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handlePrint}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            title="প্রিন্ট করুন"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPDF}
            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold"
            title="PDF ডাউনলোড"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportExcel}
            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold"
            title="এক্সেল ডাউনলোড"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex space-x-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold overflow-x-auto no-print">
        {(['daily', 'weekly', 'monthly', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setPeriod(tab)}
            className={`px-3.5 py-1.5 rounded-lg transition-all shrink-0 ${
              period === tab
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'daily'
              ? 'দৈনিক রিপোর্ট (Daily)'
              : tab === 'weekly'
              ? 'সাপ্তাহিক (Weekly)'
              : tab === 'monthly'
              ? 'মাসিক (Monthly)'
              : 'কাস্টম সময় (Custom)'}
          </button>
        ))}
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 no-print">
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

      {/* Date Header for print/display */}
      <div className="text-xs text-slate-500 font-medium">
        রিপোর্টের সময়কাল: <strong className="text-slate-800">{start} থেকে {end}</strong>
      </div>

      {/* Primary Financial Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
          <span className="text-xs font-semibold text-emerald-900">মোট বিক্রয় (Revenue)</span>
          <div className="text-xl font-black text-emerald-800">{formatBDT(totalSales, lang)}</div>
          <span className="text-[10px] text-emerald-600">খাবার বিক্রির মোট মূল্য</span>
        </div>

        <div className="p-3.5 bg-slate-100 rounded-2xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-700">খাবার তৈরিতে খরচ (COGS)</span>
          <div className="text-xl font-black text-slate-800">{formatBDT(totalCostOfGoods, lang)}</div>
          <span className="text-[10px] text-slate-500">কাঁচামাল ও উৎপাদন ব্যয়</span>
        </div>

        <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200">
          <span className="text-xs font-semibold text-amber-900">দোকান খরচ (Expenses)</span>
          <div className="text-xl font-black text-amber-800">{formatBDT(totalExpenses, lang)}</div>
          <span className="text-[10px] text-amber-600">গ্যাস, ভাড়া, বিদ্যুৎ ও বিবিধ</span>
        </div>

        <div className={`p-3.5 rounded-2xl border ${netProfit >= 0 ? 'bg-emerald-100/70 border-emerald-300' : 'bg-rose-100/70 border-rose-300'}`}>
          <span className="text-xs font-semibold text-slate-800">প্রকৃত নীট লাভ (Net Profit)</span>
          <div className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
            {formatBDT(netProfit, lang)}
          </div>
          <span className="text-[10px] text-slate-600">সকল খরচ ও অতিরিক্ত আয় সহ</span>
        </div>
      </div>

      {/* Cash Flow vs Sales vs Due Clarity Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 border-b border-slate-100 pb-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>আয়, নগদ জমা ও বকেয়ার বিবরণ (Financial Breakdown)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-500">মোট নগদ ক্যাশ জমা:</span>
            <div className="font-bold text-blue-700 text-sm mt-0.5">{formatBDT(totalCashReceived, lang)}</div>
            <span className="text-[10px] text-slate-400">বিক্রি + বাকি আদায়</span>
          </div>

          <div>
            <span className="text-slate-500">নতুন বাকি তৈরি:</span>
            <div className="font-bold text-rose-600 text-sm mt-0.5">{formatBDT(totalDueCreated, lang)}</div>
            <span className="text-[10px] text-slate-400">গ্রাহকদের কাছে পাওনা</span>
          </div>

          <div>
            <span className="text-slate-500">পুরনো বাকি আদায়:</span>
            <div className="font-bold text-emerald-700 text-sm mt-0.5">{formatBDT(totalDueCollected, lang)}</div>
            <span className="text-[10px] text-slate-400">বাকি খাতা থেকে আদায়</span>
          </div>

          <div>
            <span className="text-slate-500">অন্যান্য অতিরিক্ত আয়:</span>
            <div className="font-bold text-indigo-700 text-sm mt-0.5">{formatBDT(totalOtherIncome, lang)}</div>
            <span className="text-[10px] text-slate-400">ডেলিভারি চার্জ ইত্যাদি</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics / Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Food Items Sold Count Boxes (Diagram replaced with small item boxes matching home page) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>খাবার বিক্রয়ের সংখ্যা (Food Items Sold)</span>
            </h3>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              মোট: {totalItemsSold} টি
            </span>
          </div>

          {topProducts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">কোনো খাবার পাওয়া যায়নি</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 max-h-[350px] overflow-y-auto pr-1">
              {topProducts.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                    item.quantity > 0
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-slate-50 border-slate-200/80 opacity-70'
                  }`}
                >
                  {/* Left: Icon & Name */}
                  <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1.5">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{item.icon || '🍔'}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-slate-800 truncate">
                        {lang === 'bn' ? item.nameBn || item.name : item.name}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-medium block truncate">
                        {formatBDT(item.revenue, lang)}
                      </span>
                    </div>
                  </div>

                  {/* Right: Sold Count Badge */}
                  <div className="shrink-0 text-right">
                    <span
                      className={`px-2 py-1 text-xs font-black rounded-lg border inline-block ${
                        item.quantity > 0
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}
                    >
                      {item.quantity} টি
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses Category Breakdown */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center space-x-1.5">
            <TrendingDown className="w-4 h-4 text-amber-600" />
            <span>খরচের বিভাজন (Expense Breakdown)</span>
          </h3>

          {expenseChartData.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">কোনো খরচের তথ্য নেই</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatBDT(val as number, lang), 'পরিমাণ']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
