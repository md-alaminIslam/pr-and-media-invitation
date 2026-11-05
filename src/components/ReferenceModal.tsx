import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { DocumentData } from '../types';
import mammoth from 'mammoth/mammoth.browser';
import { parsePrTextHeuristic } from '../utils/textParser';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (data: DocumentData) => void;
}

export const ReferenceModal: React.FC<ReferenceModalProps> = ({
  isOpen,
  onClose,
  onApplyData,
}) => {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [base64File, setBase64File] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setInputText(''); setError(null); setSuccessMsg(null); setWarningMsg(null);
    setIsReadingFile(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('সর্বোচ্চ ১০ MB ফাইল দিন।');
      if (file.name.toLowerCase().endsWith('.json')) {
        const data = JSON.parse(await file.text());
        if (typeof data.eventTitleEn !== 'string' || !data.chiefGuest || !data.sender || !Array.isArray(data.specialGuests) || !Array.isArray(data.highlights)) throw new Error('সঠিক ড্রাফট ব্যাকআপ দিন।');
        onApplyData(data); onClose(); return;
      }
      if (file.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        setInputText(result.value);
      } else if (file.name.toLowerCase().endsWith('.txt')) setInputText(await file.text());
      else throw new Error('Word (.docx), TXT অথবা ড্রাফট JSON দিন। PDF থেকে টেক্সট কপি করে পেস্ট করুন।');
    } catch (err: any) { setError(err.message); }
    finally { setIsReadingFile(false); e.target.value = ''; }
  };

  const handleExtractWithAi = () => handleApplyLocalFallback();

  // Instant local fallback parser (zero reliance on external network / AI spikes)
  const handleApplyLocalFallback = () => {
    const textToParse = inputText.trim();
    if (!textToParse) {
      setError('প্রথমে ওয়ার্ড ফাইল থেকে টেক্সট এক্সট্র্যাক্ট হওয়া পর্যন্ত অপেক্ষা করুন বা টেক্সট পেস্ট করুন।');
      return;
    }
    const parsedData = parsePrTextHeuristic(textToParse);
    onApplyData(parsedData);
    setSuccessMsg('টেক্সট থেকে সফলভাবে ফিল্ডগুলো পূরণ করা হয়েছে!');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                ওয়ার্ড রেফারেন্স ফাইল / টেক্সট ইমপোর্ট
              </h2>
              <p className="text-xs text-slate-500">
                Word (.docx), TXT বা ড্রাফট JSON দিন। শনাক্ত করা তথ্য প্রয়োগের পরে যাচাই করুন।
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* File Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ওয়ার্ড (.docx) অথবা টেক্সট ফাইল আপলোড করুন
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-indigo-50/30 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".docx,.txt,.json"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
              {fileName ? (
                <div className="text-xs font-semibold text-indigo-700 flex flex-col items-center justify-center gap-1">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    {fileName}
                  </span>
                  {isReadingFile && (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                      ওয়ার্ড ফাইল থেকে টেক্সট রিড করা হচ্ছে...
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium text-slate-700">
                    কম্পিউটার থেকে ওয়ার্ড ফাইল নির্বাচন করুন
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    (.docx, .txt, .json ফাইল সমর্থিত)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Extracted or Pasted Raw Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                ফাইল থেকে পড়া টেক্সট / প্রেস নোট
              </label>
              {inputText && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> টেক্সট প্রস্তুত
                </span>
              )}
            </div>
            <textarea
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="এখানে প্রেস রিলিজের খসড়া, ইভেন্টের নাম, প্রধান অতিথি ও বিশেষ অতিথিদের তালিকা পেস্ট করুন..."
              className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
            />
          </div>

          {/* Warning Message if heuristic fallback used */}
          {warningMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>{warningMsg}</div>
            </div>
          )}

          {/* Error Message with Fallback button */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {inputText.trim() && (
                <div className="pt-2 border-t border-rose-200/80 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyLocalFallback}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    সরাসরি টেক্সট থেকে ফর্ম পূরণ করুন
                  </button>
                  <button
                    type="button"
                    onClick={handleExtractWithAi}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> আবার চেষ্টা করুন
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              {successMsg}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {inputText.trim() && (
              <button
                type="button"
                onClick={handleApplyLocalFallback}
                className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                title="সরাসরি টেক্সট থেকে মানগুলো ফিল্ডে বসান"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                সরাসরি টেক্সট থেকে বসান
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              onClick={handleExtractWithAi}
              disabled={isLoading || (!inputText.trim() && !base64File)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-300" />
              )}
              {isLoading ? 'টেক্সট বিশ্লেষণ করছে...' : 'তথ্য শনাক্ত ও প্রয়োগ করুন'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
