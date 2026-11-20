import Dexie, { type Table } from 'dexie';
import type {
  Product,
  Category,
  Sale,
  SaleItem,
  Customer,
  CustomerLedger,
  Payment,
  Expense,
  ExpenseCategory,
  OtherIncome,
  DailyClosing,
  Settings,
  AuditLog
} from './types';

export class SabbirPOSDatabase extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  sales!: Table<Sale, string>;
  saleItems!: Table<SaleItem, string>;
  customers!: Table<Customer, string>;
  customerLedger!: Table<CustomerLedger, string>;
  payments!: Table<Payment, string>;
  expenses!: Table<Expense, string>;
  expenseCategories!: Table<ExpenseCategory, string>;
  otherIncome!: Table<OtherIncome, string>;
  dailyClosings!: Table<DailyClosing, string>;
  settings!: Table<Settings, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('SabbirFastFoodDB');

    this.version(1).stores({
      products: 'id, name, category, isAvailable, createdAt',
      categories: 'id, name, order',
      sales: 'id, saleNumber, customerId, status, date, timestamp, paymentMethod, isReversed',
      saleItems: 'id, saleId, productId',
      customers: 'id, name, mobile, registrationDate, currentBalance',
      customerLedger: 'id, customerId, date, timestamp, type, saleId, paymentId',
      payments: 'id, paymentNumber, customerId, saleId, date, timestamp, paymentMethod, paymentType',
      expenses: 'id, expenseNumber, category, date, timestamp',
      expenseCategories: 'id, name',
      otherIncome: 'id, incomeNumber, category, date, timestamp',
      dailyClosings: 'id, date, closedAt',
      settings: 'key',
      auditLogs: 'id, timestamp, date, entity, entityId, action'
    });
  }
}

export const db = new SabbirPOSDatabase();

// Audit log helper
export async function logAudit(
  action: AuditLog['action'],
  entity: AuditLog['entity'],
  entityId: string,
  details: string,
  beforeState?: any,
  afterState?: any
) {
  try {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false });
    
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      timestamp: now.getTime(),
      date,
      time,
      action,
      entity,
      entityId,
      details,
      beforeState: beforeState ? JSON.stringify(beforeState) : undefined,
      afterState: afterState ? JSON.stringify(afterState) : undefined
    });
  } catch (err) {
    console.error('Audit logging failed', err);
  }
}
