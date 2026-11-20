import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logAudit } from '../db';
import type { Product, Category } from '../db/types';
import { formatBDT, parseBDT } from '../utils/currency';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Search, Image as ImageIcon } from 'lucide-react';

const EMOJI_PRESETS = ['🍔', '🍝', '🍜', '🍲', '🍗', '🥣', '🍟', '🍕', '🌭', '🥪', '🥟', '🥤', '☕', '🍦'];

export const ProductsPage: React.FC = () => {
  const { lang, t } = useSettings();
  const { showToast } = useToast();

  const products = useLiveQuery<Product[]>(() => db.products.toArray(), []);
  const categories = useLiveQuery<Category[]>(
    () => db.categories.toArray().then((cats) => cats.sort((a, b) => a.order - b.order)),
    []
  );

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [category, setCategory] = useState('Fast Food');
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [icon, setIcon] = useState('🍔');
  const [image, setImage] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Delete State
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setNameBn('');
    setCategory(categories?.[0]?.name || 'Fast Food');
    setSellingPrice(0);
    setCostPrice(0);
    setIcon('🍔');
    setImage('');
    setIsAvailable(true);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setNameBn(p.nameBn || '');
    setCategory(p.category);
    setSellingPrice(p.sellingPrice);
    setCostPrice(p.costPrice);
    setIcon(p.icon || '🍔');
    setImage(p.image || '');
    setIsAvailable(p.isAvailable);
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        showToast({ type: 'warning', title: 'ছবির সাইজ ১MB এর কম হতে হবে' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ type: 'error', title: 'পণ্যের নাম লিখুন' });
      return;
    }
    if (sellingPrice <= 0) {
      showToast({ type: 'error', title: 'বিক্রয় মূল্য নির্ধারণ করুন' });
      return;
    }

    try {
      const now = Date.now();
      if (editingProduct) {
        // Update product
        const updated: Product = {
          ...editingProduct,
          name: name.trim(),
          nameBn: nameBn.trim() || undefined,
          category,
          sellingPrice,
          costPrice,
          icon,
          image: image || undefined,
          isAvailable,
          updatedAt: now
        };
        await db.products.put(updated);
        await logAudit('UPDATE', 'product', editingProduct.id, `Product updated: ${name}`, editingProduct, updated);
        showToast({ type: 'success', title: 'পণ্য সফলভাবে হালনাগাদ করা হয়েছে' });
      } else {
        // Create product
        const id = crypto.randomUUID();
        const newProduct: Product = {
          id,
          name: name.trim(),
          nameBn: nameBn.trim() || undefined,
          category,
          sellingPrice,
          costPrice,
          icon,
          image: image || undefined,
          isAvailable,
          order: (products?.length || 0) + 1,
          createdAt: now,
          updatedAt: now
        };
        await db.products.add(newProduct);
        await logAudit('CREATE', 'product', id, `New product created: ${name}`);
        showToast({ type: 'success', title: 'নতুন পণ্য যোগ করা হয়েছে' });
      }

      setIsModalOpen(false);
    } catch (err: any) {
      showToast({ type: 'error', title: 'পণ্য সংরক্ষণে সমস্যা', message: err.message });
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      await db.products.delete(deletingProduct.id);
      await logAudit('DELETE', 'product', deletingProduct.id, `Deleted product: ${deletingProduct.name}`);
      showToast({ type: 'success', title: 'পণ্য মুছে ফেলা হয়েছে' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'মুছতে ব্যর্থ', message: err.message });
    } finally {
      setDeletingProduct(null);
    }
  };

  const toggleAvailability = async (product: Product) => {
    const updatedStatus = !product.isAvailable;
    await db.products.update(product.id, { isAvailable: updatedStatus, updatedAt: Date.now() });
    showToast({
      type: updatedStatus ? 'success' : 'info',
      title: updatedStatus ? 'পণ্যটি সক্রিয় করা হয়েছে' : 'পণ্যটি নিষ্ক্রিয় করা হয়েছে'
    });
  };

  // Filter products
  const filteredProducts = products?.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.nameBn && p.nameBn.includes(search));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">পণ্য সমূহ (Products)</h1>
          <p className="text-xs text-slate-500">মেনু আইটেম যোগ ও মূল্য নির্ধারণ করুন</p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-press flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন পণ্য</span>
        </button>
      </div>

      {/* Search & Category Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="পণ্য খুঁজুন (নাম বা বাংলা নাম)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        >
          <option value="all">সকল ক্যাটাগরি (All)</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.name}>
              {lang === 'bn' ? c.nameBn || c.name : c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Product List */}
      <div className="space-y-2">
        {filteredProducts?.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 text-sm">
            কোনো পণ্য পাওয়া যায়নি
          </div>
        ) : (
          filteredProducts?.map((product) => (
            <div
              key={product.id}
              className={`p-3 rounded-2xl border bg-white shadow-xs flex items-center justify-between transition-all ${
                !product.isAvailable ? 'opacity-60 bg-slate-50' : 'hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{product.icon || '🍔'}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-slate-800 truncate">
                      {lang === 'bn' ? product.nameBn || product.name : product.name}
                    </h3>
                    {!product.isAvailable && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700">
                        বন্ধ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                    <span className="font-semibold text-emerald-700">
                      বিক্রি: {formatBDT(product.sellingPrice, lang)}
                    </span>
                    <span>•</span>
                    <span>ক্রয়: {formatBDT(product.costPrice, lang)}</span>
                    <span>•</span>
                    <span className="text-[10px] text-slate-400">{product.category}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={() => toggleAvailability(product)}
                  className={`p-2 rounded-lg text-xs font-semibold ${
                    product.isAvailable
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                  title={product.isAvailable ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                >
                  {product.isAvailable ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => openEditModal(product)}
                  className="p-2 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                  title="এডিট করুন"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingProduct(product)}
                  className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  title="মুছে ফেলুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য যোগ করুন'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProduct} className="space-y-3.5">
          {/* Bengali & English Name */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">বাংলা নাম</label>
              <input
                type="text"
                placeholder="যেমন: বার্গার"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">English Name</label>
              <input
                type="text"
                placeholder="e.g. Burger"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.nameBn})
                </option>
              ))}
            </select>
          </div>

          {/* Pricing: Selling Price & Cost Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">বিক্রয় মূল্য (Selling Price ৳)</label>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={sellingPrice || ''}
                onChange={(e) => setSellingPrice(parseBDT(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold text-emerald-700 rounded-lg border border-slate-300 text-right"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ক্রয়/খরচ মূল্য (Cost Price ৳)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={costPrice || ''}
                onChange={(e) => setCostPrice(parseBDT(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold text-slate-700 rounded-lg border border-slate-300 text-right"
              />
            </div>
          </div>

          {/* Icon Preset Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">আইকন নির্বাচন</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
              {EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setIcon(em);
                    setImage('');
                  }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all ${
                    icon === em && !image
                      ? 'bg-emerald-600 text-white scale-110 shadow-sm'
                      : 'bg-white hover:bg-slate-100'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload Option */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">অথবা ছবি আপলোড করুন</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            {image && (
              <div className="mt-2 flex items-center space-x-2">
                <img src={image} alt="Preview" className="w-12 h-12 object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  ছবি সরান
                </button>
              </div>
            )}
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isAvail"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <label htmlFor="isAvail" className="text-xs font-semibold text-slate-700 cursor-pointer">
              মেনুতে সক্রিয় ও বিক্রির জন্য প্রস্তুত রাখুন
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all"
          >
            {editingProduct ? 'পরিবর্তন সংরক্ষণ করুন' : 'পণ্য যোগ করুন'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDeleteProduct}
        title="পণ্য মুছে ফেলা"
        message={`আপনি কি নিশ্চিত "${deletingProduct?.name}" মুছে ফেলতে চান?\nআগের বিক্রির ইতিহাসে কোনো প্রভাব পড়বে না।`}
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
      />
    </div>
  );
};
