// Database types for Sabbir Fast Food POS

export interface Product {
  id: string; // UUID
  name: string; // e.g. "Burger"
  nameBn?: string; // e.g. "বার্গার"
  category: string; // e.g. "Fast Food"
  sellingPrice: number; // Integer BDT
  costPrice: number; // Integer BDT
  image?: string; // Base64 data URL or preset identifier
  icon?: string; // Preset icon identifier
  isAvailable: boolean; // Active status
  order?: number;
  createdAt: number; // Timestamp ms
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  nameBn?: string;
  order: number;
}

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'due' | 'split';
export type SaleStatus = 'completed' | 'cancelled' | 'refunded';

export interface Sale {
  id: string; // UUID
  saleNumber: string; // e.g. "S-20261120-001"
  totalAmount: number; // Sum of selling prices
  discountAmount: number; // Discount in BDT
  payableAmount: number; // totalAmount - discountAmount
  paidAmount: number; // Amount paid now
  dueAmount: number; // Remaining due
  paymentMethod: PaymentMethod;
  customerId?: string; // Linked customer if due/named
  customerName?: string;
  customerMobile?: string;
  status: SaleStatus;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm:ss"
  timestamp: number; // ms timestamp
  notes?: string;
  isReversed?: boolean; // If sale was undone/voided
  reversedAt?: number;
}

export interface SaleItem {
  id: string; // UUID
  saleId: string; // Indexed
  productId: string; // Indexed
  productName: string;
  productNameBn?: string;
  quantity: number;
  unitCostPrice: number; // Snapshot of cost at sale time
  unitSellingPrice: number; // Snapshot of selling price at sale time
  subtotalCost: number; // unitCostPrice * quantity
  subtotalSelling: number; // unitSellingPrice * quantity
}

export interface Customer {
  id: string; // UUID
  name: string;
  mobile: string;
  address?: string;
  notes?: string;
  totalDue: number; // Lifetime due created
  totalPaid: number; // Lifetime payment received
  currentBalance: number; // Outstanding due balance
  registrationDate: string; // "YYYY-MM-DD"
  createdAt: number;
  updatedAt: number;
}

export type LedgerEntryType = 'debit' | 'credit';

export interface CustomerLedger {
  id: string; // UUID
  customerId: string; // Indexed
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm:ss"
  timestamp: number; // ms
  type: LedgerEntryType; // 'debit' (food purchase / due created) or 'credit' (payment received)
  description: string; // e.g. "Burger x 2, Pasta x 1" or "Payment via bKash"
  debit: number; // Amount added to due (BDT)
  credit: number; // Amount paid (BDT)
  balance: number; // Running customer balance after this transaction
  saleId?: string; // Optional link to sale
  paymentId?: string; // Optional link to payment
  notes?: string;
}

export type PaymentType = 'sale' | 'due_collection' | 'advance';

export interface Payment {
  id: string; // UUID
  paymentNumber: string; // e.g. "PAY-20261120-001"
  customerId?: string; // Indexed
  customerName?: string;
  saleId?: string; // Indexed
  amount: number; // Integer BDT
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'other';
  paymentType: PaymentType;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm:ss"
  timestamp: number;
  notes?: string;
}

export interface Expense {
  id: string; // UUID
  expenseNumber: string; // e.g. "EXP-20261120-001"
  title: string; // e.g. "Gas Cylinder", "Chicken Purchase"
  category: string; // e.g. "Gas & Fuel", "Ingredients", "Rent", "Utilities"
  quantity?: number;
  unit?: string; // "kg", "liter", "pcs", "month", etc.
  unitPrice?: number;
  totalAmount: number; // Integer BDT
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm:ss"
  timestamp: number;
  notes?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  nameBn?: string;
}

export interface OtherIncome {
  id: string; // UUID
  incomeNumber: string;
  title: string; // e.g. "Delivery Charges", "Scrap Sale"
  category: string;
  amount: number; // Integer BDT
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm:ss"
  timestamp: number;
  description?: string;
}

export interface DailyClosing {
  id: string; // UUID (usually date string or UUID)
  date: string; // "YYYY-MM-DD" (Indexed)
  openingCash: number;
  totalSales: number; // Total gross sales
  totalCostOfGoods: number; // Total cost price of items sold
  totalCashReceived: number; // Total cash collected (sales + due collections)
  totalDueCreated: number; // Dues added today
  totalDueCollected: number; // Dues collected today
  totalExpenses: number; // Total expenses today
  otherIncome: number; // Other income today
  estimatedGrossProfit: number; // totalSales - totalCostOfGoods
  estimatedNetProfit: number; // estimatedGrossProfit - totalExpenses + otherIncome
  expectedClosingCash: number; // openingCash + totalCashReceived - cashExpenses
  actualClosingCash?: number; // Counted cash in drawer
  cashDifference?: number; // actual - expected
  closedAt: number; // ms timestamp
  closedBy?: string;
  notes?: string;
  isReopened?: boolean;
}

export interface Settings {
  key: string;
  value: any;
}

export interface ShopSettings {
  shopName: string;
  shopNameBn: string;
  shopLogo?: string;
  ownerName: string;
  mobile: string;
  address: string;
  currency: string; // "BDT"
  currencySymbol: string; // "৳"
  language: 'bn' | 'en';
  dateFormat: string;
  openingTime: string;
  closingTime: string;
  autoBackupReminderDays: number;
  lastBackupDate?: string;
  soundEnabled: boolean;
}

export interface AuditLog {
  id: string; // UUID
  timestamp: number;
  date: string;
  time: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVERSE' | 'IMPORT' | 'RESTORE' | 'CLOSE_DAY';
  entity: 'sale' | 'product' | 'customer' | 'expense' | 'payment' | 'closing' | 'settings';
  entityId: string;
  details: string;
  beforeState?: string; // JSON snapshot
  afterState?: string; // JSON snapshot
}
