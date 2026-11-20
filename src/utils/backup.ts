// Full Database Backup & Restore Utility
import { db, logAudit } from '../db';
import { getDhakaDateString } from './date';

export interface BackupData {
  app: string;
  version: string;
  timestamp: number;
  date: string;
  summary: {
    productsCount: number;
    salesCount: number;
    saleItemsCount: number;
    customersCount: number;
    ledgerCount: number;
    paymentsCount: number;
    expensesCount: number;
    otherIncomeCount: number;
    dailyClosingsCount: number;
  };
  tables: {
    products: any[];
    categories: any[];
    sales: any[];
    saleItems: any[];
    customers: any[];
    customerLedger: any[];
    payments: any[];
    expenses: any[];
    expenseCategories: any[];
    otherIncome: any[];
    dailyClosings: any[];
    settings: any[];
    auditLogs: any[];
  };
}

/**
 * Export full IndexedDB database to a structured JSON file and trigger browser download
 */
export async function exportDatabaseBackup(): Promise<{ filename: string; recordCount: number }> {
  const [
    products,
    categories,
    sales,
    saleItems,
    customers,
    customerLedger,
    payments,
    expenses,
    expenseCategories,
    otherIncome,
    dailyClosings,
    settings,
    auditLogs
  ] = await Promise.all([
    db.products.toArray(),
    db.categories.toArray(),
    db.sales.toArray(),
    db.saleItems.toArray(),
    db.customers.toArray(),
    db.customerLedger.toArray(),
    db.payments.toArray(),
    db.expenses.toArray(),
    db.expenseCategories.toArray(),
    db.otherIncome.toArray(),
    db.dailyClosings.toArray(),
    db.settings.toArray(),
    db.auditLogs.toArray()
  ]);

  const totalRecords =
    products.length +
    categories.length +
    sales.length +
    saleItems.length +
    customers.length +
    customerLedger.length +
    payments.length +
    expenses.length +
    expenseCategories.length +
    otherIncome.length +
    dailyClosings.length +
    settings.length;

  const now = new Date();
  const dateStr = getDhakaDateString(now);
  const timeFormatted = now.toTimeString().split(' ')[0].replace(/:/g, '');

  const backup: BackupData = {
    app: 'SabbirFastFoodPOS',
    version: '1.0.0',
    timestamp: now.getTime(),
    date: dateStr,
    summary: {
      productsCount: products.length,
      salesCount: sales.length,
      saleItemsCount: saleItems.length,
      customersCount: customers.length,
      ledgerCount: customerLedger.length,
      paymentsCount: payments.length,
      expensesCount: expenses.length,
      otherIncomeCount: otherIncome.length,
      dailyClosingsCount: dailyClosings.length
    },
    tables: {
      products,
      categories,
      sales,
      saleItems,
      customers,
      customerLedger,
      payments,
      expenses,
      expenseCategories,
      otherIncome,
      dailyClosings,
      settings,
      auditLogs
    }
  };

  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const filename = `sabbir-pos-backup-${dateStr}-${timeFormatted}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Update last backup date in settings
  const existingSettings = await db.settings.get('shop_settings');
  if (existingSettings) {
    await db.settings.put({
      key: 'shop_settings',
      value: { ...existingSettings.value, lastBackupDate: dateStr }
    });
  }

  await logAudit('CREATE', 'settings', 'backup', `Database backup exported (${totalRecords} records)`);

  return { filename, recordCount: totalRecords };
}

/**
 * Validate imported JSON file
 */
export function validateBackupFile(jsonData: any): { valid: boolean; error?: string; backup?: BackupData } {
  if (!jsonData || typeof jsonData !== 'object') {
    return { valid: false, error: 'অবৈধ ফাইল ফরম্যাট (Invalid file format)' };
  }

  if (jsonData.app !== 'SabbirFastFoodPOS') {
    return { valid: false, error: 'এটি সাব্বির পিওএস ব্যাকআপ ফাইল নয় (Not a valid Sabbir POS backup)' };
  }

  if (!jsonData.tables || typeof jsonData.tables !== 'object') {
    return { valid: false, error: 'ফাইলে প্রয়োজনীয় টেবিল পাওয়া যায়নি (Database tables missing)' };
  }

  return { valid: true, backup: jsonData as BackupData };
}

/**
 * Restore database from backup
 * mode: 'replace' (wipes tables first) or 'merge' (upserts records)
 */
export async function restoreDatabaseBackup(
  backup: BackupData,
  mode: 'replace' | 'merge' = 'replace'
): Promise<void> {
  const { tables } = backup;

  await db.transaction(
    'rw',
    [
      db.products,
      db.categories,
      db.sales,
      db.saleItems,
      db.customers,
      db.customerLedger,
      db.payments,
      db.expenses,
      db.expenseCategories,
      db.otherIncome,
      db.dailyClosings,
      db.settings,
      db.auditLogs
    ],
    async () => {
      if (mode === 'replace') {
        // Clear all tables before restore
        await Promise.all([
          db.products.clear(),
          db.categories.clear(),
          db.sales.clear(),
          db.saleItems.clear(),
          db.customers.clear(),
          db.customerLedger.clear(),
          db.payments.clear(),
          db.expenses.clear(),
          db.expenseCategories.clear(),
          db.otherIncome.clear(),
          db.dailyClosings.clear(),
          db.settings.clear()
        ]);
      }

      // Restore/merge tables
      if (tables.products?.length) await db.products.bulkPut(tables.products);
      if (tables.categories?.length) await db.categories.bulkPut(tables.categories);
      if (tables.sales?.length) await db.sales.bulkPut(tables.sales);
      if (tables.saleItems?.length) await db.saleItems.bulkPut(tables.saleItems);
      if (tables.customers?.length) await db.customers.bulkPut(tables.customers);
      if (tables.customerLedger?.length) await db.customerLedger.bulkPut(tables.customerLedger);
      if (tables.payments?.length) await db.payments.bulkPut(tables.payments);
      if (tables.expenses?.length) await db.expenses.bulkPut(tables.expenses);
      if (tables.expenseCategories?.length) await db.expenseCategories.bulkPut(tables.expenseCategories);
      if (tables.otherIncome?.length) await db.otherIncome.bulkPut(tables.otherIncome);
      if (tables.dailyClosings?.length) await db.dailyClosings.bulkPut(tables.dailyClosings);
      if (tables.settings?.length) await db.settings.bulkPut(tables.settings);
    }
  );

  await logAudit('RESTORE', 'settings', 'restore', `Database restored in ${mode} mode from backup dated ${backup.date}`);
}

/**
 * Clear all transactional and master data (factory reset)
 */
export async function clearAllLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.products,
      db.categories,
      db.sales,
      db.saleItems,
      db.customers,
      db.customerLedger,
      db.payments,
      db.expenses,
      db.expenseCategories,
      db.otherIncome,
      db.dailyClosings,
      db.settings,
      db.auditLogs
    ],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.categories.clear(),
        db.sales.clear(),
        db.saleItems.clear(),
        db.customers.clear(),
        db.customerLedger.clear(),
        db.payments.clear(),
        db.expenses.clear(),
        db.expenseCategories.clear(),
        db.otherIncome.clear(),
        db.dailyClosings.clear(),
        db.settings.clear(),
        db.auditLogs.clear()
      ]);
    }
  );
}
