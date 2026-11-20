import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ShopSettings } from '../db/types';
import { formatBDT } from '../utils/currency';
import { exportDatabaseBackup, validateBackupFile, restoreDatabaseBackup, clearAllLocalData, type BackupData } from '../utils/backup';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Modal } from '../components/common/Modal';
import {
  Settings as SettingsIcon,
  HardDriveDownload,
  UploadCloud,
  Trash2,
  ShieldCheck,
  Globe,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Database
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, lang, setLang, t } = useSettings();
  const { showToast } = useToast();

  // Shop Profile state
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopNameBn, setShopNameBn] = useState(settings.shopNameBn);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [mobile, setMobile] = useState(settings.mobile);
  const [address, setAddress] = useState(settings.address);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [autoBackupReminderDays, setAutoBackupReminderDays] = useState(settings.autoBackupReminderDays);

  // Backup & Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Clear Local Data State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  // Live database stats
  const productsCount = useLiveQuery(() => db.products.count(), []) ?? 0;
  const salesCount = useLiveQuery(() => db.sales.count(), []) ?? 0;
  const customersCount = useLiveQuery(() => db.customers.count(), []) ?? 0;
  const expensesCount = useLiveQuery(() => db.expenses.count(), []) ?? 0;
  const auditCount = useLiveQuery(() => db.auditLogs.count(), []) ?? 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        shopName: shopName.trim(),
        shopNameBn: shopNameBn.trim(),
        ownerName: ownerName.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        soundEnabled,
        autoBackupReminderDays
      });
      showToast({ type: 'success', title: 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'সংরক্ষণ ব্যর্থ', message: err.message });
    }
  };

  // Full Database Backup Export
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const res = await exportDatabaseBackup();
      showToast({
        type: 'success',
        title: 'ব্যাকআপ ফাইল সফলভাবে ডাউনলোড হয়েছে!',
        message: `ফাইল: ${res.filename} (${res.recordCount} টি রেকর্ড)`
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'ব্যাকআপ নিতে ব্যর্থ', message: err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Select Backup File for Import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const val = validateBackupFile(json);
        if (!val.valid || !val.backup) {
          showToast({ type: 'error', title: 'ভুল ফাইল ফরম্যাট', message: val.error });
          return;
        }

        setPendingBackup(val.backup);
        setIsImportConfirmOpen(true);
      } catch (err) {
        showToast({ type: 'error', title: 'ফাইলটি পড়তে পারেনি। সঠিক JSON ফাইল সিলেক্ট করুন।' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!pendingBackup) return;
    setIsRestoring(true);
    try {
      await restoreDatabaseBackup(pendingBackup, importMode);
      showToast({
        type: 'success',
        title: 'ডাটাবেজ সফলভাবে রিস্টোর হয়েছে!',
        message: 'সকল তথ্য IndexedDB তে সফলভাবে লোড হয়েছে।'
      });
      setIsImportConfirmOpen(false);
      setPendingBackup(null);
      // Reload page to re-initialize contexts smoothly
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast({ type: 'error', title: 'রিস্টোর করতে সমস্যা হয়েছে', message: err.message });
    } finally {
      setIsRestoring(false);
    }
  };

  // Factory Reset / Clear Data
  const handleExecuteClearData = async () => {
    if (clearConfirmText !== 'DELETE') {
      showToast({ type: 'error', title: 'নিশ্চিত করতে "DELETE" টাইপ করুন' });
      return;
    }
    try {
      await clearAllLocalData();
      showToast({ type: 'success', title: 'সকল লোকাল ডাটা সফলভাবে মুছে ফেলা হয়েছে' });
      setIsClearModalOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast({ type: 'error', title: 'ডাটা মুছতে ব্যর্থ', message: err.message });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-800">সেটিংস (Settings)</h1>
        <p className="text-xs text-slate-500">দোকানের বিবরণ, ব্যাকআপ ও লোকাল ডাটাবেজ নিয়ন্ত্রণ</p>
      </div>

      {/* 100% Offline Promise Banner */}
      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start space-x-3">
        <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 leading-relaxed">
          <strong className="block text-sm font-bold text-emerald-950 mb-0.5">
            ১০০% নিরাপদ ও অফলাইন লোকাল ডাটাবেজ
          </strong>
          আপনার দোকানের সমস্ত তথ্য (বিক্রি, খরচ, বাকি খাতা ও নগদ টাকা) সরাসরি আপনার স্মার্টফোনের ব্রাউজার মেমোরিতে (IndexedDB) সংরক্ষিত থাকে। কোনো তথ্য ক্লাউড সার্ভারে পাঠানো হয় না।
        </div>
      </div>

      {/* Shop Profile Form */}
      <form onSubmit={handleSaveProfile} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 border-b border-slate-100 pb-2">
          <SettingsIcon className="w-4 h-4 text-emerald-600" />
          <span>দোকানের প্রোফাইল তথ্য</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">দোকানের নাম (বাংলা)</label>
            <input
              type="text"
              value={shopNameBn}
              onChange={(e) => setShopNameBn(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Shop Name (English)</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মালিকের নাম</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">মোবাইল নম্বর (রসিদে প্রদর্শনের জন্য)</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">দোকানের ঠিকানা</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
          />
        </div>

        {/* Preferences: Language & Sound */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">অ্যাপের ভাষা (Language)</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'bn' | 'en')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="bn">বাংলা (Bengali)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ব্যাকআপ রিমাইন্ডার ব্যবধান</label>
            <select
              value={autoBackupReminderDays}
              onChange={(e) => setAutoBackupReminderDays(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value={1}>প্রতিদিন (Everyday)</option>
              <option value={3}>প্রতি ৩ দিন পর পর</option>
              <option value={7}>সাপ্তাহিক (Weekly)</option>
              <option value={15}>১৫ দিন পর পর</option>
              <option value={0}>বন্ধ রাখুন (Off)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="soundCheck"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded"
          />
          <label htmlFor="soundCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
            ট্যাপ ও বিক্রির মিষ্টি সাউন্ড এফেক্ট চালু রাখুন
          </label>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md active:scale-98 transition-all"
        >
          প্রোফাইল পরিবর্তন সংরক্ষণ করুন
        </button>
      </form>

      {/* Backup & Restore Section (CRITICAL) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
            <HardDriveDownload className="w-4 h-4 text-blue-600" />
            <span>ব্যাকআপ ও রিস্টোর (Backup & Restore)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            আপনার স্মার্টফোনের ডাউনলোড ফোল্ডারে সম্পূর্ণ ডাটা ব্যাকআপ সংরক্ষণ করুন
          </p>
        </div>

        {settings.lastBackupDate && (
          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between">
            <span>সর্বশেষ ব্যাকআপ নেওয়ার তারিখ:</span>
            <strong className="text-slate-800">{settings.lastBackupDate}</strong>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Export Full Backup Button */}
          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="btn-press flex items-center justify-center space-x-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>{isExporting ? 'ব্যাকআপ তৈরি হচ্ছে...' : 'সম্পূর্ণ ব্যাকআপ ডাউনলোড করুন'}</span>
          </button>

          {/* Import Backup Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-press w-full flex items-center justify-center space-x-2 p-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>ব্যাকআপ ফাইল থেকে রিস্টোর</span>
            </button>
          </div>
        </div>
      </div>

      {/* Database Statistics */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 border-b border-slate-100 pb-2">
          <Database className="w-4 h-4 text-purple-600" />
          <span>ফোনে সংরক্ষিত ডাটা পরিসংখ্যান (IndexedDB)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-2 bg-slate-50 rounded-lg text-center">
            <span className="text-slate-500">পণ্য:</span>
            <div className="font-bold text-slate-800">{productsCount} টি</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg text-center">
            <span className="text-slate-500">মোট বিক্রি:</span>
            <div className="font-bold text-slate-800">{salesCount} টি</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg text-center">
            <span className="text-slate-500">গ্রাহক খাতা:</span>
            <div className="font-bold text-slate-800">{customersCount} জন</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg text-center">
            <span className="text-slate-500">খরচ রেকর্ড:</span>
            <div className="font-bold text-slate-800">{expensesCount} টি</div>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg text-center">
            <span className="text-slate-500">অডিট লগ:</span>
            <div className="font-bold text-slate-800">{auditCount} টি</div>
          </div>
        </div>
      </div>

      {/* Danger Zone: Clear Local Data */}
      <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 shadow-xs space-y-2">
        <h2 className="text-xs font-bold text-rose-800 flex items-center space-x-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>বিপদজনক এলাকা (Danger Zone)</span>
        </h2>
        <p className="text-[11px] text-slate-600">
          ফোনে জমা থাকা সমস্ত হিসাব ও ট্রানজেকশন মুছে একদম নতুন অবস্থায় ফিরিয়ে নিতে পারেন।
        </p>
        <button
          onClick={() => {
            setClearConfirmText('');
            setIsClearModalOpen(true);
          }}
          className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm"
        >
          সকল লোকাল ডাটা মুছে ফেলুন (Factory Reset)
        </button>
      </div>

      {/* Import Backup Preview & Mode Confirmation Modal */}
      <Modal
        isOpen={isImportConfirmOpen}
        onClose={() => setIsImportConfirmOpen(false)}
        title="ব্যাকআপ রিস্টোর নিশ্চিতকরণ"
        maxWidth="md"
      >
        {pendingBackup && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
              <div className="font-bold text-blue-900 text-sm">ব্যাকআপ ফাইলের বিবরণ:</div>
              <div>তারিখ: <strong>{pendingBackup.date}</strong></div>
              <div>পণ্য: {pendingBackup.summary.productsCount}টি | বিক্রি: {pendingBackup.summary.salesCount}টি</div>
              <div>গ্রাহক: {pendingBackup.summary.customersCount}জন | খরচ: {pendingBackup.summary.expensesCount}টি</div>
            </div>

            {/* Select Restore Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                রিস্টোর করার অপশন নির্বাচন করুন:
              </label>
              <div className="space-y-2">
                <label className="flex items-start space-x-2.5 p-2.5 rounded-xl border bg-slate-50 hover:bg-slate-100 cursor-pointer">
                  <input
                    type="radio"
                    name="restoreMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 text-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">১. পূর্বের ডাটা মুছে প্রতিস্থাপন (Replace)</span>
                    <span className="text-[11px] text-slate-500">
                      বর্তমান ডাটা পুরোপুরি মুছে ফেলে ব্যাকআপ ফাইলের ডাটা বসাবে (সুপারিশকৃত)।
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 p-2.5 rounded-xl border bg-slate-50 hover:bg-slate-100 cursor-pointer">
                  <input
                    type="radio"
                    name="restoreMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-0.5 text-emerald-600"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">২. বর্তমান ডাটার সাথে একত্রীকরণ (Merge)</span>
                    <span className="text-[11px] text-slate-500">
                      বর্তমান ডাটা অক্ষত রেখে ব্যাকআপ থেকে নতুন রেকর্ড যোগ করবে।
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsImportConfirmOpen(false)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
              >
                {isRestoring ? 'রিস্টোর হচ্ছে...' : 'রিস্টোর নিশ্চিত করুন'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear Data Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="সকল ডাটা মুছে ফেলা নিশ্চিত করুন"
        maxWidth="sm"
      >
        <div className="space-y-3 text-xs">
          <p className="text-rose-700 font-semibold leading-relaxed">
            সতর্কবার্তা: এটি সম্পন্ন করলে আপনার ফোনের ব্রাউজার থেকে সমস্ত বিক্রি, খরচ ও বাকি খাতা স্থায়ীভাবে মুছে যাবে।
          </p>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              নিশ্চিত করতে নিচে <strong>DELETE</strong> লিখুন:
            </label>
            <input
              type="text"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 text-sm font-bold border border-rose-300 rounded-xl text-center"
            />
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              onClick={() => setIsClearModalOpen(false)}
              className="flex-1 py-2 border border-slate-300 rounded-xl font-semibold"
            >
              বাতিল
            </button>
            <button
              onClick={handleExecuteClearData}
              disabled={clearConfirmText !== 'DELETE'}
              className="flex-1 py-2 bg-rose-600 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-md"
            >
              মুছে ফেলুন
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
