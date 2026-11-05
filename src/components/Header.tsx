import React from 'react';
import { FileText, Sparkles, UploadCloud, RefreshCw, Layers, ExternalLink } from 'lucide-react';
import { DocumentData } from '../types';
import { blankPreset } from '../utils/presets';

interface HeaderProps {
  onSelectPreset: (preset: DocumentData) => void;
  onOpenReferenceModal: () => void;
  onAiSync: () => void;
  isAiSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectPreset,
  onOpenReferenceModal,
  onAiSync,
  isAiSyncing,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              SAVOR Media Studio
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                বাংলা & English
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              মিডিয়া ইনভিটেশন ও প্রেস রিলিজ
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <button onClick={() => onSelectPreset(blankPreset)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300">নতুন ফাঁকা কাজ</button>

          {/* Reference Modal Button */}
          <button
            onClick={onOpenReferenceModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-lg border border-indigo-200 transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-indigo-600" />
            ওয়ার্ড / রেফারেন্স ফাইল
          </button>

          {/* AI Bilingual Translate & Sync */}
          <button
            onClick={onAiSync}
            disabled={isAiSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
            title="ইংরেজি থেকে ফাঁকা বাংলা ফিল্ড পূরণ করুন; বানান যাচাই করুন"
          >
            {isAiSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            )}
            {isAiSyncing ? 'সিঙ্ক হচ্ছে...' : 'ফাঁকা বাংলা পূরণ'}
          </button>

          {/* Full Tab for Direct Printing */}
          <a
            href={typeof window !== 'undefined' ? window.location.href : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
            title="সরাসরি প্রিন্ট করার জন্য অ্যাপটি ব্রাউজারের আলাদা ট্যাবে ওপেন করুন"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            আলাদা উইন্ডো / সরাসরি প্রিন্ট
          </a>
        </div>
      </div>
    </header>
  );
};
