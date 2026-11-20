import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { verifyActivationPassword, markDeviceAsActivated } from '../../config/security';
import { sound } from '../../utils/sound';

interface ActivationScreenProps {
  onActivate: () => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({ onActivate }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('অনুগ্রহ করে অ্যাক্টিভেশন পাসওয়ার্ড প্রদান করুন');
      return;
    }

    if (verifyActivationPassword(password)) {
      setIsSuccess(true);
      sound.playSuccess();
      markDeviceAsActivated();

      // Brief smooth transition before revealing dashboard
      setTimeout(() => {
        onActivate();
      }, 700);
    } else {
      setError('ভুল অ্যাক্টিভেশন পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।');
      sound.playUndo();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 select-none relative overflow-hidden font-sans">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Activation Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 z-10 transition-all">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white p-6 sm:p-8 text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mx-auto flex items-center justify-center text-3xl shadow-inner mb-3">
            🍔
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">সাব্বির ফাস্ট ফুড পিওএস</h1>
          <p className="text-xs text-emerald-100 font-medium mt-1">
            ডিভাইস অ্যাক্টিভেশন (One-Time Activation)
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-start space-x-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              অনুমোদিত ব্যবহার নিশ্চিত করতে এই ডিভাইসে প্রথমবার ব্যবহারের জন্য সিকিউরিটি পাসওয়ার্ড প্রয়োজন। একবার সক্রিয় হলে আর পাসওয়ার্ড লাগবে না।
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                অ্যাক্টিভেশন পাসওয়ার্ড (Activation Password)
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="পাসওয়ার্ড লিখুন..."
                  autoFocus
                  className={`w-full pl-4 pr-11 py-3 text-sm rounded-xl border font-mono transition-all outline-none ${
                    error
                      ? 'border-rose-400 bg-rose-50/50 focus:border-rose-500'
                      : 'border-slate-300 bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
                  }`}
                />

                {/* Show/Hide Password Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {isSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-bold">সফলভাবে অ্যাক্টিভেট হয়েছে! অ্যাপ্লিকেশন লোড হচ্ছে...</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSuccess}
              className={`w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-md active:scale-98 transition-all flex items-center justify-center space-x-2 ${
                isSuccess
                  ? 'bg-emerald-600'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{isSuccess ? 'অ্যাক্টিভেটেড ✅' : 'অ্যাক্টিভ করুন (Activate)'}</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          ১০০% অফলাইন সিকিউরিটি • নো ক্লাউড • নো ইন্টারনেট
        </div>
      </div>
    </div>
  );
};
