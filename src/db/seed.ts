import { db } from './index';
import type { Product, Category, ExpenseCategory, ShopSettings } from './types';

export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Sabbir Fast Food',
  shopNameBn: 'সাব্বির ফাস্ট ফুড',
  ownerName: 'সাব্বির আহমেদ (Sabbir Ahmed)',
  mobile: '01700000000',
  address: 'ঢাকা, বাংলাদেশ',
  currency: 'BDT',
  currencySymbol: '৳',
  language: 'bn',
  dateFormat: 'YYYY-MM-DD',
  openingTime: '10:00',
  closingTime: '23:00',
  autoBackupReminderDays: 3,
  soundEnabled: true
};

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-fast-food', name: 'Fast Food', nameBn: 'ফাস্ট ফুড', order: 1 },
  { id: 'cat-snacks', name: 'Snacks & Sides', nameBn: 'স্ন্যাকস ও সাইডস', order: 2 },
  { id: 'cat-beverages', name: 'Beverages', nameBn: 'পানীয়', order: 3 }
];

export const INITIAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'exp-gas', name: 'Gas Cylinder', nameBn: 'গ্যাস সিলিন্ডার' },
  { id: 'exp-meat', name: 'Chicken & Meat', nameBn: 'মুরগি ও মাংস' },
  { id: 'exp-raw-food', name: 'Pasta & Noodles', nameBn: 'পাস্তা ও নুডলস' },
  { id: 'exp-oil', name: 'Cooking Oil', nameBn: 'ভোজ্য তেল' },
  { id: 'exp-veg', name: 'Vegetables & Spices', nameBn: 'সবজি ও মশলা' },
  { id: 'exp-sauce', name: 'Sauces & Dairy', nameBn: 'সস ও দুগ্ধজাত' },
  { id: 'exp-packaging', name: 'Packaging & Boxes', nameBn: 'প্যাকেজিং বক্স' },
  { id: 'exp-rent', name: 'Shop Rent', nameBn: 'দোকান ভাড়া' },
  { id: 'exp-utility', name: 'Electricity & Utilities', nameBn: 'বিদ্যুৎ ও বিল' },
  { id: 'exp-other', name: 'Other Expenses', nameBn: 'অন্যান্য খরচ' }
];

// Initial 7 Products requested:
// 1. Burger
// 2. Pasta
// 3. Chowmein
// 4. Mix Pasta
// 5. Chicken Lollipop
// 6. Soup
// 7. French Fry
export const INITIAL_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Burger',
    nameBn: 'বার্গার',
    category: 'Fast Food',
    sellingPrice: 120,
    costPrice: 70,
    icon: '🍔',
    isAvailable: true,
    order: 1
  },
  {
    name: 'Pasta',
    nameBn: 'পাস্তা',
    category: 'Fast Food',
    sellingPrice: 150,
    costPrice: 85,
    icon: '🍝',
    isAvailable: true,
    order: 2
  },
  {
    name: 'Chowmein',
    nameBn: 'চাউমিন',
    category: 'Fast Food',
    sellingPrice: 130,
    costPrice: 75,
    icon: '🍜',
    isAvailable: true,
    order: 3
  },
  {
    name: 'Mix Pasta',
    nameBn: 'মিক্স পাস্তা',
    category: 'Fast Food',
    sellingPrice: 180,
    costPrice: 100,
    icon: '🍲',
    isAvailable: true,
    order: 4
  },
  {
    name: 'Chicken Lollipop',
    nameBn: 'চিকেন ললিপপ',
    category: 'Fast Food',
    sellingPrice: 140,
    costPrice: 80,
    icon: '🍗',
    isAvailable: true,
    order: 5
  },
  {
    name: 'Soup',
    nameBn: 'স্যুপ',
    category: 'Fast Food',
    sellingPrice: 100,
    costPrice: 55,
    icon: '🥣',
    isAvailable: true,
    order: 6
  },
  {
    name: 'French Fry',
    nameBn: 'ফ্রেন্চ ফ্রাই',
    category: 'Snacks & Sides',
    sellingPrice: 80,
    costPrice: 40,
    icon: '🍟',
    isAvailable: true,
    order: 7
  }
];

export async function seedInitialDatabaseIfEmpty() {
  const productCount = await db.products.count();
  if (productCount === 0) {
    const now = Date.now();
    for (const p of INITIAL_PRODUCTS) {
      await db.products.add({
        ...p,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      });
    }
  }

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(INITIAL_CATEGORIES);
  }

  const expenseCategoryCount = await db.expenseCategories.count();
  if (expenseCategoryCount === 0) {
    await db.expenseCategories.bulkAdd(INITIAL_EXPENSE_CATEGORIES);
  }

  const settingsRecord = await db.settings.get('shop_settings');
  if (!settingsRecord) {
    await db.settings.put({
      key: 'shop_settings',
      value: DEFAULT_SETTINGS
    });
  }
}
