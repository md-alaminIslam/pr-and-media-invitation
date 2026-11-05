import React, { useState, useRef, useEffect } from 'react';
import {
  UserCheck,
  Users,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Award,
  Briefcase,
  Sparkles,
  Wand2,
  Zap,
  RefreshCw,
  Check,
} from 'lucide-react';
import { DocumentData, GuestItem } from '../types';
import { translateGuestField, rememberGuestCorrection, needsGuestReview, GuestEnglishField } from '../utils/guestTranslation';

interface GuestEditorProps {
  onTranslateRequested?:()=>void;
  data: DocumentData;
  onChange: (updatedData: DocumentData) => void;
}

export const GuestEditor: React.FC<GuestEditorProps> = ({ data, onChange, onTranslateRequested }) => {
  const translate = (text: string, field: GuestEnglishField) => translateGuestField(text, field, data.translationCorrections);
  const chiefNeedsReview = (['nameEn','honorsEn','designationEn'] as const).some(field => needsGuestReview(data.chiefGuest[field], field, data.translationCorrections));
  const [autoBangla, setAutoBangla] = useState(true);
  const [loadingChief, setLoadingChief] = useState(false);
  const [loadingGuests, setLoadingGuests] = useState<Record<string, boolean>>({});
  const [autoConvertedToast, setAutoConvertedToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setAutoConvertedToast(msg);
    setTimeout(() => setAutoConvertedToast(null), 3000);
  };

  const updateChiefGuest = (field: keyof DocumentData['chiefGuest'], value: string) => {
    const englishField = field.replace(/Bn$/, 'En') as GuestEnglishField;
    onChange({
      ...data,
      translationCorrections: field.endsWith('Bn') ? rememberGuestCorrection(data.translationCorrections, data.chiefGuest[englishField], englishField, value) : data.translationCorrections,
      chiefGuest: {
        ...data.chiefGuest,
        [field]: value,
      },
    });
  };

  // Instant High-Accuracy Translation for Chief Guest
  const handleChiefEnglishChange = (
    field: 'nameEn' | 'designationEn' | 'honorsEn',
    val: string
  ) => {
    const updatedChief = {
      ...data.chiefGuest,
      [field]: val,
    };

    if (autoBangla || field === 'nameEn') {
      if (field === 'nameEn') {
        updatedChief.nameBn = translate(val, field);
      } else if (field === 'designationEn') {
        updatedChief.designationBn = translate(val, field);
      } else if (field === 'honorsEn') {
        updatedChief.honorsBn = translate(val, field);
      }
    }

    onChange({
      ...data,
      chiefGuest: updatedChief,
    });
  };

  const manualConvertChief = () => {
    if(onTranslateRequested){onTranslateRequested();return;}
    const nameBn = translate(data.chiefGuest.nameEn || '', 'nameEn');
    const desigBn = translate(data.chiefGuest.designationEn || '', 'designationEn');
    const honorsBn = translate(data.chiefGuest.honorsEn || '', 'honorsEn');

    onChange({
      ...data,
      chiefGuest: {
        ...data.chiefGuest,
        nameBn: nameBn,
        designationBn: desigBn,
        honorsBn: honorsBn,
      },
    });
    showToast('✨ প্রধান অতিথির নাম ও পদবী বাংলায় আপডেট হয়েছে!');
  };

  // Translate all guests (Chief + all Special Guests) at once
  const translateAllGuests = () => {
    if(onTranslateRequested){onTranslateRequested();return;}
    const updatedChief = {
      ...data.chiefGuest,
      nameBn: translate(data.chiefGuest.nameEn || '', 'nameEn'),
      designationBn: translate(data.chiefGuest.designationEn || '', 'designationEn'),
      honorsBn: translate(data.chiefGuest.honorsEn || '', 'honorsEn'),
    };

    const updatedSpecial = data.specialGuests.map((g) => ({
      ...g,
      nameBn: translate(g.nameEn || '', 'nameEn'),
      designationBn: translate(g.designationEn || '', 'designationEn'),
      honorsBn: translate(g.honorsEn || '', 'honorsEn'),
    }));

    onChange({
      ...data,
      chiefGuest: updatedChief,
      specialGuests: updatedSpecial,
    });
    showToast('✨ সকল অতিথির নাম ও পদবী বাংলায় সফলভাবে রূপান্তর হয়েছে!');
  };

  // Special Guests
  const addSpecialGuest = () => {
    const newGuest: GuestItem = {
      id: `sg-${Date.now()}`,
      nameBn: '',
      nameEn: '',
      honorsBn: '',
      honorsEn: '',
      designationBn: '',
      designationEn: '',
    };
    onChange({
      ...data,
      specialGuests: [...data.specialGuests, newGuest],
    });
  };

  const updateSpecialGuest = (id: string, field: keyof GuestItem, value: string) => {
    const guest = data.specialGuests.find(g => g.id === id);
    const englishField = field.replace(/Bn$/, 'En') as GuestEnglishField;
    onChange({
      ...data,
      translationCorrections: guest && field.endsWith('Bn') ? rememberGuestCorrection(data.translationCorrections, guest[englishField] || '', englishField, value) : data.translationCorrections,
      specialGuests: data.specialGuests.map((guest) =>
        guest.id === id ? { ...guest, [field]: value } : guest
      ),
    });
  };

  // Auto-translate Special Guest from English
  const handleGuestEnglishChange = (
    guestId: string,
    field: 'nameEn' | 'designationEn' | 'honorsEn',
    val: string
  ) => {
    const guest = data.specialGuests.find((g) => g.id === guestId);
    if (!guest) return;

    let updatedNameBn = guest.nameBn;
    let updatedDesignationBn = guest.designationBn;
    let updatedHonorsBn = guest.honorsBn;

    if (autoBangla || field === 'nameEn') {
      if (field === 'nameEn') {
        updatedNameBn = translate(val, field);
      } else if (field === 'designationEn') {
        updatedDesignationBn = translate(val, field);
      } else if (field === 'honorsEn') {
        updatedHonorsBn = translate(val, field);
      }
    }

    onChange({
      ...data,
      specialGuests: data.specialGuests.map((g) =>
        g.id === guestId
          ? {
              ...g,
              [field]: val,
              nameBn: updatedNameBn,
              designationBn: updatedDesignationBn,
              honorsBn: updatedHonorsBn,
            }
          : g
      ),
    });
  };

  const manualConvertSpecialGuest = (guestId: string) => {
    if(onTranslateRequested){onTranslateRequested();return;}
    const guest = data.specialGuests.find((g) => g.id === guestId);
    if (!guest) return;

    const nameBn = translate(guest.nameEn || '', 'nameEn');
    const desigBn = translate(guest.designationEn || '', 'designationEn');
    const honorsBn = translate(guest.honorsEn || '', 'honorsEn');

    onChange({
      ...data,
      specialGuests: data.specialGuests.map((g) =>
        g.id === guestId
          ? {
              ...g,
              nameBn: nameBn,
              designationBn: desigBn,
              honorsBn: honorsBn,
            }
          : g
      ),
    });
    showToast('✨ বিশেষ অতিথির নাম ও পদবী বাংলায় সফলভাবে রূপান্তর হয়েছে!');
  };

  const removeSpecialGuest = (id: string) => {
    onChange({
      ...data,
      specialGuests: data.specialGuests.filter((g) => g.id !== id),
    });
  };

  const moveGuest = (index: number, direction: 'up' | 'down') => {
    const newGuests = [...data.specialGuests];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newGuests.length) return;
    const temp = newGuests[index];
    newGuests[index] = newGuests[targetIndex];
    newGuests[targetIndex] = temp;
    onChange({
      ...data,
      specialGuests: newGuests,
    });
  };

  return (
    <div className="space-y-6">
      {/* Auto Bangla Feature Notification Banner */}
      <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
              অতিথির বাংলা তথ্য চার ডকুমেন্টে একসাথে আপডেট হয়
              <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-emerald-700">
              {onTranslateRequested?'Gemini নির্বাচিত। ইংরেজি তথ্য লিখে অনুবাদ বাটন চাপুন, তারপর যাচাই করে প্রয়োগ করুন।':'ইংরেজি লিখলে বাংলা খসড়া তৈরি হবে। বাংলা ঘরে সংশোধন করলে এই ব্রাউজারে সেই বানান মনে থাকবে। অপরিচিত পদবী ইংরেজিতে থাকবে; নামের বানান যাচাই করুন।'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={translateAllGuests}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
            title="সকল অতিথির ইংরেজি তথ্য বাংলায় রূপান্তর করুন"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            সব অতিথি বাংলায় রূপান্তর
          </button>
          <button
            disabled={!!onTranslateRequested}
            onClick={() => setAutoBangla(!autoBangla)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              autoBangla
                ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
            title="পদবী ও সম্মাননার অটো বাংলা চালু বা বন্ধ করুন; নাম সবসময় সিঙ্ক হবে"
          >
            {autoBangla ? <Check className="w-3.5 h-3.5" /> : null}
            {autoBangla ? 'পদবী অটো বাংলা চালু' : 'পদবী অটো বাংলা বন্ধ'}
          </button>
        </div>
      </div>

      {/* Floating Mini Toast */}
      {autoConvertedToast && (
        <div className="p-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-3.5 h-3.5 text-amber-200" />
          <span>{autoConvertedToast}</span>
        </div>
      )}

      {chiefNeedsReview && <p role="status" className="text-xs leading-6 border border-amber-200 bg-amber-50 text-amber-900 rounded-xl p-3">প্রধান অতিথির কিছু শব্দের বাংলা নিশ্চিত নয়। অপরিচিত নামের বানান যাচাই করুন; ইংরেজিতে থাকা পদবী/প্রতিষ্ঠান বাংলায় লিখুন। আপনার সংশোধন মনে রাখা হবে।</p>}
      {/* Chief Guest Section */}
      <div className="bg-white rounded-xl border border-blue-200 shadow-2xs overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
              <UserCheck className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                প্রধান অতিথি (Chief Guest)
              </h3>
              <p className="text-[11px] text-slate-500">
                ইভেন্টের উদ্বোধক বা প্রধান অতিথির নাম ও পদবী
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loadingChief && (
              <span className="text-[11px] text-blue-600 flex items-center gap-1 font-semibold animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> বাংলায় তৈরি হচ্ছে...
              </span>
            )}
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              বাধ্যতামূলক
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Chief Guest Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                  Chief Guest Name (English)
                </label>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 font-semibold px-1.5 py-0.5 rounded border border-indigo-200">
                  প্রথমে এখানে লিখুন
                </span>
              </div>
              <input
                type="text"
                value={data.chiefGuest.nameEn}
                onChange={(e) => handleChiefEnglishChange('nameEn', e.target.value)}
                placeholder="Chief guest name in English"
                className="w-full px-3 py-2 text-sm border-2 border-indigo-400 focus:border-indigo-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-indigo-50/25 font-medium"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-400 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                  প্রধান অতিথির নাম (বাংলা)
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-600 font-medium">স্বয়ংক্রিয় তৈরি হবে</span>
                  <button
                    onClick={manualConvertChief}
                    disabled={loadingChief || !data.chiefGuest.nameEn}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title="ইংরেজি নাম থেকে সরাসরি বাংলায় রূপান্তর করুন"
                  >
                    <Wand2 className="w-3 h-3" /> রূপান্তর
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={data.chiefGuest.nameBn}
                onChange={(e) => updateChiefGuest('nameBn', e.target.value)}
                placeholder="প্রধান অতিথির বাংলা নাম"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Chief Guest Honors / Titles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                Honors / Titles / Degrees (English)
              </label>
              <input
                type="text"
                value={data.chiefGuest.honorsEn}
                onChange={(e) => handleChiefEnglishChange('honorsEn', e.target.value)}
                placeholder="e.g. OSP, NPP, rcds, afwc, psc, PhD"
                className="w-full px-3 py-1.5 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-indigo-50/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                সম্মাননা / ডিগ্রি / টাইটেল (বাংলা)
              </label>
              <input
                type="text"
                value={data.chiefGuest.honorsBn}
                onChange={(e) => updateChiefGuest('honorsBn', e.target.value)}
                placeholder="যেমন: ওএসপি, এনপিপি, পিএইচডি বা OSP, NPP, PhD"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Chief Guest Designation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  Designation & Organization (English)
                </label>
                <span className="text-[10px] text-indigo-600 font-medium">এখানে লিখুন</span>
              </div>
              <input
                type="text"
                value={data.chiefGuest.designationEn}
                onChange={(e) => handleChiefEnglishChange('designationEn', e.target.value)}
                placeholder="e.g. Assistant Chief of Naval Staff (O), Bangladesh Navy"
                className="w-full px-3 py-2 text-sm border border-indigo-300 focus:border-indigo-500 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-indigo-50/20"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  পদবী ও প্রতিষ্ঠান (বাংলা)
                </label>
                <span className="text-[10px] text-emerald-600 font-medium">স্বয়ংক্রিয় তৈরি হবে</span>
              </div>
              <input
                type="text"
                value={data.chiefGuest.designationBn}
                onChange={(e) => updateChiefGuest('designationBn', e.target.value)}
                placeholder="যেমন: সহকারী নৌবাহিনী প্রধান (অপারেশনস), বাংলাদেশ নৌবাহিনী"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Special Guests Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
              <Users className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                বিশেষ অতিথিবৃন্দ (Special Guests)
              </h3>
              <p className="text-[11px] text-slate-500">
                এক বা একাধিক বিশেষ অতিথি যোগ, পরিবর্তন বা ক্রম সাজান
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full font-medium">
              {data.specialGuests.length} জন অতিথি
            </span>
            <button
              onClick={addSpecialGuest}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              অতিথি যোগ করুন
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {data.specialGuests.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Users className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-medium text-slate-600">কোনো বিশেষ অতিথি যুক্ত করা হয়নি</p>
              <button
                onClick={addSpecialGuest}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> প্রথম বিশেষ অতিথি যোগ করুন
              </button>
            </div>
          ) : (
            data.specialGuests.map((guest, index) => {
              const isGuestTranslating = loadingGuests[guest.id];

              return (
                <div
                  key={guest.id}
                  className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors space-y-3"
                >
                  {/* Guest Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        বিশেষ অতিথি #{index + 1}: {guest.nameBn || guest.nameEn || 'নতুন অতিথি'}
                      </span>
                      {isGuestTranslating && (
                        <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-1 animate-pulse">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> বাংলায় তৈরি হচ্ছে...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => manualConvertSpecialGuest(guest.id)}
                        disabled={isGuestTranslating || !guest.nameEn}
                        className="px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        title="ইংরেজি থেকে সরাসরি বাংলায় রূপান্তর করুন"
                      >
                        <Wand2 className="w-3 h-3" /> অটো বাংলা
                      </button>
                      <button
                        onClick={() => moveGuest(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 cursor-pointer"
                        title="উপরে নিন"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveGuest(index, 'down')}
                        disabled={index === data.specialGuests.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 cursor-pointer"
                        title="নিচে নিন"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeSpecialGuest(guest.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {(['nameEn','honorsEn','designationEn'] as const).some(field=>needsGuestReview(guest[field] || '',field,data.translationCorrections)) && <p className="text-xs leading-6 text-amber-900 bg-amber-50 p-2 rounded-lg">এই অতিথির নামের বানান / ইংরেজিতে থাকা পদবী যাচাই করে বাংলায় সংশোধন করুন। সংশোধন মনে রাখা হবে।</p>}
                  {/* Name fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-bold">1</span>
                          Name (English)
                        </label>
                        <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                          প্রথমে এখানে লিখুন
                        </span>
                      </div>
                      <input
                        type="text"
                        value={guest.nameEn}
                        onChange={(e) => handleGuestEnglishChange(guest.id, 'nameEn', e.target.value)}
                        placeholder="Guest name in English"
                        className="w-full px-2.5 py-1.5 text-xs border-2 border-indigo-300 focus:border-indigo-500 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-indigo-50/25 font-medium"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full bg-slate-400 text-white text-[9px] flex items-center justify-center font-bold">2</span>
                          নাম (বাংলা)
                        </label>
                        <span className="text-[10px] text-emerald-600 font-medium">স্বয়ংক্রিয় তৈরি হবে</span>
                      </div>
                      <input
                        type="text"
                        value={guest.nameBn}
                        onChange={(e) => updateSpecialGuest(guest.id, 'nameBn', e.target.value)}
                        placeholder="অতিথির বাংলা নাম"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Honors/Title fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Honors/Titles (English, optional)
                      </label>
                      <input
                        type="text"
                        value={guest.honorsEn || ''}
                        onChange={(e) => handleGuestEnglishChange(guest.id, 'honorsEn', e.target.value)}
                        placeholder="e.g. OSP, ndc, afwc, psc"
                        className="w-full px-2.5 py-1 text-xs border border-indigo-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-indigo-50/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                        ডিগ্রি/সম্মাননা (বাংলা, ঐচ্ছিক)
                      </label>
                      <input
                        type="text"
                        value={guest.honorsBn || ''}
                        onChange={(e) => updateSpecialGuest(guest.id, 'honorsBn', e.target.value)}
                        placeholder="যেমন: ওএসপি, এনডিসি বা AFNI"
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Designation fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[11px] font-medium text-slate-700">
                          Designation & Organization (English)
                        </label>
                        <span className="text-[10px] text-indigo-600 font-medium">এখানে লিখুন</span>
                      </div>
                      <input
                        type="text"
                        value={guest.designationEn}
                        onChange={(e) => handleGuestEnglishChange(guest.id, 'designationEn', e.target.value)}
                        placeholder="e.g. Vice President, Bangladesh China Chamber of Commerce"
                        className="w-full px-2.5 py-1.5 text-xs border border-indigo-300 focus:border-indigo-500 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-indigo-50/20"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[11px] font-medium text-slate-700">
                          পদবী ও প্রতিষ্ঠান (বাংলা)
                        </label>
                        <span className="text-[10px] text-emerald-600 font-medium">স্বয়ংক্রিয় তৈরি হবে</span>
                      </div>
                      <input
                        type="text"
                        value={guest.designationBn}
                        onChange={(e) => updateSpecialGuest(guest.id, 'designationBn', e.target.value)}
                        placeholder="যেমন: সহ-সভাপতি, বাংলাদেশ চায়না চেম্বার অব কমার্স"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {data.specialGuests.length > 0 && (
            <button
              onClick={addSpecialGuest}
              className="w-full py-2 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> আরও একজন বিশেষ অতিথি যোগ করুন
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
