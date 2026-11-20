import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import type { ShopSettings } from '../db/types';
import { DEFAULT_SETTINGS, seedInitialDatabaseIfEmpty } from '../db/seed';
import { sound } from '../utils/sound';
import { getDhakaDateString } from '../utils/date';

interface SettingsContextType {
  settings: ShopSettings;
  updateSettings: (newSettings: Partial<ShopSettings>) => Promise<void>;
  lang: 'bn' | 'en';
  setLang: (lang: 'bn' | 'en') => Promise<void>;
  isInitialized: boolean;
  needsBackupReminder: boolean;
  dismissBackupReminder: () => void;
  t: (key: string, defaultText?: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Multilingual translations map
const TRANSLATIONS: Record<string, { bn: string; en: string }> = {
  // Navigation
  nav_home: { bn: 'হোম', en: 'Home' },
  nav_sales: { bn: 'বিক্রি তালিকা', en: 'Sales History' },
  nav_products: { bn: 'পণ্য সমূহ', en: 'Products' },
  nav_expenses: { bn: 'খরচ সমূহ', en: 'Expenses' },
  nav_customers: { bn: 'বাকি খাতা', en: 'Due / Customers' },
  nav_payments: { bn: 'পেমেন্ট হিস্ট্রি', en: 'Payments' },
  nav_income: { bn: 'অন্যান্য আয়', en: 'Other Income' },
  nav_reports: { bn: 'রিপোর্ট ও লাভ', en: 'Reports' },
  nav_closing: { bn: 'দৈনিক ক্লোজিং', en: 'Daily Closing' },
  nav_settings: { bn: 'সেটিংস', en: 'Settings' },

  // Dashboard Stats
  today_sales: { bn: 'আজকের মোট বিক্রি', en: "Today's Total Sales" },
  today_cash: { bn: 'নগদ জমা', en: 'Cash Received' },
  today_due: { bn: 'আজকের বাকি', en: "Today's Due" },
  today_expenses: { bn: 'আজকের খরচ', en: "Today's Expenses" },
  items_sold: { bn: 'মোট আইটেম', en: 'Items Sold' },
  total_orders: { bn: 'মোট অর্ডার', en: 'Total Orders' },
  estimated_profit: { bn: 'আনুমানিক লাভ', en: 'Estimated Profit' },

  // Quick buttons
  btn_add_due: { bn: '+ বাকি বিক্রি', en: '+ Add Due' },
  btn_add_expense: { bn: '+ খরচ লিখুন', en: '+ Add Expense' },
  btn_add_income: { bn: '+ অন্যান্য আয়', en: '+ Add Income' },
  btn_reports: { bn: 'রিপোর্ট দেখুন', en: 'View Reports' },

  // Actions & Common
  save: { bn: 'সংরক্ষণ করুন', en: 'Save' },
  cancel: { bn: 'বাতিল', en: 'Cancel' },
  delete: { bn: 'মুছে ফেলুন', en: 'Delete' },
  edit: { bn: 'সম্পাদনা', en: 'Edit' },
  view: { bn: 'দেখুন', en: 'View' },
  undo: { bn: 'আনডু', en: 'Undo' },
  all: { bn: 'সকল', en: 'All' },
  date: { bn: 'তারিখ', en: 'Date' },
  time: { bn: 'সময়', en: 'Time' },
  amount: { bn: 'টাকার পরিমাণ', en: 'Amount' },
  cash: { bn: 'নগদ', en: 'Cash' },
  bkash: { bn: 'বিকাশ', en: 'bKash' },
  nagad: { bn: 'নগদ (Nagad)', en: 'Nagad' },
  due: { bn: 'বাকি', en: 'Due' },
  offline_notice: { bn: '১০০% অফলাইন - কোনো ইন্টারনেট প্রয়োজন নেই', en: '100% Offline - No internet required' }
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [needsBackupReminder, setNeedsBackupReminder] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      try {
        await seedInitialDatabaseIfEmpty();
        const stored = await db.settings.get('shop_settings');
        if (stored?.value) {
          setSettings(stored.value);
          sound.setEnabled(stored.value.soundEnabled ?? true);

          // Check backup reminder
          if (stored.value.autoBackupReminderDays > 0) {
            const today = getDhakaDateString();
            const lastBackup = stored.value.lastBackupDate;
            if (!lastBackup) {
              setNeedsBackupReminder(true);
            } else {
              const diffDays = Math.floor(
                (new Date(today).getTime() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)
              );
              if (diffDays >= stored.value.autoBackupReminderDays) {
                setNeedsBackupReminder(true);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setIsInitialized(true);
      }
    }
    init();
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<ShopSettings>) => {
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      sound.setEnabled(merged.soundEnabled);
      await db.settings.put({
        key: 'shop_settings',
        value: merged
      });
    },
    [settings]
  );

  const setLang = useCallback(
    async (lang: 'bn' | 'en') => {
      await updateSettings({ language: lang });
    },
    [updateSettings]
  );

  const dismissBackupReminder = useCallback(() => {
    setNeedsBackupReminder(false);
  }, []);

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const entry = TRANSLATIONS[key];
      if (entry) {
        return entry[settings.language] || entry.bn || defaultText || key;
      }
      return defaultText || key;
    },
    [settings.language]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        lang: settings.language,
        setLang,
        isInitialized,
        needsBackupReminder,
        dismissBackupReminder,
        t
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
