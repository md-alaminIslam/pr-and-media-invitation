import { renderHtmlTemplate, renderTemplate, DOCUMENT_SLOTS } from '../utils/templates';
import React, { useEffect, useState } from 'react';
import {
  Download,
  Printer,
  Copy,
  Check,
  Eye,
  FileText,
  FileDown,
  RefreshCw,
  Columns,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { DocumentData, DocumentType } from '../types';
import {
  formatChiefGuestBn,
  formatChiefGuestEn,
  formatSpecialGuestsBn,
  formatSpecialGuestsEn,
  generateMediaInvitationBn,
  generateMediaInvitationEn,
  generatePressReleaseBn,
  generatePressReleaseEn,
} from '../utils/documentGenerator';
import { exportToDocx } from '../utils/docxExporter';
import { exportToPdf } from '../utils/pdfGenerator';
import { PageMargins, loadPageMargins, printPageCss, savePageMargins } from '../utils/pageMargins';
import { PageMarginControl } from './PageMarginControl';

interface DocumentPreviewProps {
  data: DocumentData;
  activeDoc: DocumentType;
  onDocChange: (doc: DocumentType) => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  data,
  activeDoc,
  onDocChange,
}) => {
  const hasDocument = (type: DocumentType) => !data.uploadsOnly || (type.startsWith('dual-') ? (type === 'dual-invitation' ? ['invitation-bn','invitation-en'] : ['press-release-bn','press-release-en']).every(t=>!!data.templates?.[t as keyof NonNullable<DocumentData['templates']>]) : !!data.templates?.[type as keyof NonNullable<DocumentData['templates']>]);
  const availableDocuments=DOCUMENT_SLOTS.filter(s=>hasDocument(s.type));
  const activeHasDocument=hasDocument(activeDoc);
  const [copied, setCopied] = useState(false);
  const [margins, setMargins] = useState<PageMargins>(() => loadPageMargins());

  // Persist margins and apply them to browser printing via a dynamic @page rule.
  useEffect(() => {
    savePageMargins(margins);
    let style = document.getElementById('print-page-margins') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'print-page-margins';
      document.head.appendChild(style);
    }
    style.textContent = printPageCss(margins);
  }, [margins]);
  const [downloading, setDownloading] = useState(false);

  const handleCopyText = async () => {
    let text = '';
    if (activeDoc === 'invitation-bn') text = generateMediaInvitationBn(data);
    else if (activeDoc === 'invitation-en') text = generateMediaInvitationEn(data);
    else if (activeDoc === 'press-release-bn') text = generatePressReleaseBn(data);
    else if (activeDoc === 'press-release-en') text = generatePressReleaseEn(data);
    else if (activeDoc === 'dual-invitation') {
      text = generateMediaInvitationBn(data) + '\n\n=== ENGLISH ===\n' + generateMediaInvitationEn(data);
    } else {
      text =
        `=== বাংলা ===\n` +
        generatePressReleaseBn(data) +
        `\n\n=== ENGLISH ===\n` +
        generatePressReleaseEn(data);
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadWord = async (typeToDownload = activeDoc) => {
    if (typeToDownload === 'dual-invitation' || typeToDownload === 'dual-press-release') {
      const prefix = typeToDownload === 'dual-invitation' ? 'invitation' : 'press-release';
      await handleDownloadWord(`${prefix}-bn` as DocumentType);
      await handleDownloadWord(`${prefix}-en` as DocumentType);
      return;
    }
    try {
      setDownloading(true);
      const targetType = typeToDownload;

      const blob = await exportToDocx(data, targetType, margins);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      let filename = 'Document.docx';
      if (targetType === 'invitation-bn') filename = `${data.editionBn || 'Media_Invitation'}_Bangla.docx`;
      else if (targetType === 'invitation-en') filename = `${data.editionEn || 'Media_Invitation'}_English.docx`;
      else if (targetType === 'press-release-bn') filename = `${data.editionBn || 'Press_Release'}_Bangla.docx`;
      else if (targetType === 'press-release-en') filename = `${data.editionEn || 'Press_Release'}_English.docx`;

      a.download = filename.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating docx:', err);
      alert('Failed to generate Word document.');
    } finally {
      setDownloading(false);
    }
  };

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    try {
      setGeneratingPdf(true);
      await exportToPdf(data, activeDoc, margins);
      setPdfToast('✅ PDF ফাইল সফলভাবে ডাউনলোড হয়েছে!');
      setTimeout(() => setPdfToast(null), 4500);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setPdfToast('❌ PDF তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setTimeout(() => setPdfToast(null), 4500);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = async () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-100/70 border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      {/* Top Document Tabs */}
      <div className="bg-white border-b border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            hidden={!hasDocument('invitation-bn')}
            onClick={() => onDocChange('invitation-bn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDoc === 'invitation-bn'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            ✉️ ইনভিটেশন (বাংলা)
          </button>
          <button
            hidden={!hasDocument('invitation-en')}
            onClick={() => onDocChange('invitation-en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDoc === 'invitation-en'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            ✉️ Invitation (English)
          </button>
          <button
            hidden={!hasDocument('press-release-bn')}
            onClick={() => onDocChange('press-release-bn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDoc === 'press-release-bn'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            📰 প্রেস রিলিজ (বাংলা)
          </button>
          <button
            hidden={!hasDocument('press-release-en')}
            onClick={() => onDocChange('press-release-en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeDoc === 'press-release-en'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            📰 Press Release (English)
          </button>
          <button
            hidden={!hasDocument(activeDoc.includes('invitation') ? 'dual-invitation' : 'dual-press-release')}
            onClick={() => onDocChange(activeDoc.includes('invitation') ? 'dual-invitation' : 'dual-press-release')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              activeDoc.startsWith('dual-')
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="বাংলা ও ইংরেজি একসাথে পাশাপাশি দেখুন"
          >
            <Columns className="w-3.5 h-3.5" />
            দ্বৈত ভিউ
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            disabled={!activeHasDocument}
            onClick={handleCopyText}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="মিডিয়া টেক্সট কপি করুন"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? 'কপি হয়েছে!' : 'কপি টেক্সট'}
          </button>

          {/* Direct PDF Download button */}
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf || !activeHasDocument}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            title="সরাসরি PDF ফাইল (.pdf) হিসেবে ডাউনলোড করুন"
          >
            {generatingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            {generatingPdf ? 'PDF তৈরি হচ্ছে...' : 'PDF ডাউনলোড'}
          </button>

          <PageMarginControl margins={margins} onChange={setMargins} />

          {/* Direct Print button */}
          <button
            disabled={!activeHasDocument}
            onClick={handlePrint}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            title="প্রিন্টার দিয়ে প্রিন্ট করুন"
          >
            <Printer className="w-3.5 h-3.5" />
            প্রিন্ট
          </button>

          {/* Word Download button */}
          <button
            onClick={() => handleDownloadWord()}
            disabled={downloading || !activeHasDocument}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            title="মাইক্রোসফট ওয়ার্ড (.docx) ফাইল হিসেবে ডাউনলোড করুন"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'ওয়ার্ড তৈরি হচ্ছে...' : 'ওয়ার্ড (.docx)'}
          </button>
        </div>
      </div>

      {/* Document Viewport */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-200/50">
        <div
          id="printable-document"
          className="w-full max-w-4xl"
          style={{
            '--page-margin-top': `${margins.top}in`,
            '--page-margin-right': `${margins.right}in`,
            '--page-margin-bottom': `${margins.bottom}in`,
            '--page-margin-left': `${margins.left}in`,
          } as React.CSSProperties}
        >
          {!activeHasDocument ? <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500"><FileText className="w-10 h-10 mx-auto mb-3 text-slate-300"/><p className="font-semibold">এখনো কোনো ডকুমেন্ট প্রয়োগ করা হয়নি</p><p className="text-sm mt-2">উপরে ফাইল নির্বাচন করে “সাবমিট ও প্রয়োগ করুন” চাপুন।</p></div> : activeDoc === 'dual-invitation' ? (
            <div className="space-y-6"><div className="document-sheet page-sheet bg-white font-bangla"><MediaInvitationBanglaView data={data} /></div><div className="document-sheet page-sheet bg-white font-english"><MediaInvitationEnglishView data={data} /></div></div>
          ) : activeDoc === 'dual-press-release' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dual View: Bangla Sheet */}
              <div className="page-sheet bg-white shadow-md border border-slate-300/80 rounded-sm font-bangla text-slate-900 min-h-[750px] relative">
                <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 no-print">
                  বাংলা প্রেস রিলিজ
                </div>
                <PressReleaseBanglaView data={data} />
              </div>
              {/* Dual View: English Sheet */}
              <div className="page-sheet bg-white shadow-md border border-slate-300/80 rounded-sm font-english text-slate-900 min-h-[750px] relative">
                <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 no-print">
                  English Press Release
                </div>
                <PressReleaseEnglishView data={data} />
              </div>
            </div>
          ) : (
            <div className="page-sheet bg-white shadow-md border border-slate-300/80 rounded-sm text-slate-900 min-h-[950px] w-full max-w-[210mm] mx-auto">
              {activeDoc === 'invitation-bn' && <MediaInvitationBanglaView data={data} />}
              {activeDoc === 'invitation-en' && <MediaInvitationEnglishView data={data} />}
              {activeDoc === 'press-release-bn' && <PressReleaseBanglaView data={data} />}
              {activeDoc === 'press-release-en' && <PressReleaseEnglishView data={data} />}
            </div>
          )}
        </div>
      </div>

      {/* Print & PDF Notification Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  🖨️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    প্রিন্ট ও PDF সংরক্ষণ নির্দেশিকা
                  </h3>
                  <p className="text-xs text-slate-500">
                    সরাসরি প্রিন্ট বা ফাইল সংরক্ষণ করতে
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3 mb-5">
              <div className="font-bold text-blue-900 flex items-center gap-1.5 text-sm">
                <span>🖨️</span> সরাসরি (Direct) প্রিন্ট করার ২টি সহজ উপায়:
              </div>

              <div className="p-3 bg-white/95 border border-blue-300 rounded-xl space-y-1.5 text-slate-800">
                <div className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
                  <span>⚡</span> উপায় ১ (কীবোর্ড শর্টকাট — সবচেয়ে দ্রুত):
                </div>
                <p className="text-slate-600 leading-normal">
                  প্রিভিউ ডকুমেন্টের ওপর মাউস রেখে কীবোর্ডে <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] font-bold">Ctrl + P</kbd> (Mac এ <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[11px] font-bold">Cmd + P</kbd>) চাপুন। সাথে সাথে আপনার সিস্টেমের আসল প্রিন্টার উইন্ডো ওপেন হবে এবং কোনো সাইডবার ছাড়াই <strong>শুধুমাত্র মূল চিঠিটিই</strong> নিখুঁতভাবে প্রিন্ট হবে।
                </p>
              </div>

              <div className="p-3 bg-white/95 border border-emerald-300 rounded-xl space-y-1.5 text-slate-800">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                  <span>📄</span> উপায় ২ (ডাউনলোড হওয়া PDF ফাইল):
                </div>
                <p className="text-slate-600 leading-normal">
                  আপনার সুবিধার জন্য ব্যাকআপ হিসেবে পরিষ্কার PDF ফাইলটিও সাথে সাথে ডাউনলোড করা হয়েছে। Downloads ফোল্ডার থেকে ফাইলটি খুলেও যেকোনো প্রিন্টারে প্রিন্ট করতে পারেন।
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold cursor-pointer border border-indigo-200"
                title="আলাদা ব্রাউজার ট্যাবে ওপেন করে সরাসরি এক ক্লিকে প্রিন্ট করুন"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                আলাদা উইন্ডোতে খুলুন
              </a>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf()}
                  disabled={generatingPdf}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF ডাউনলোড
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  বুঝেছি
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Toast */}
      {pdfToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
          <span>{pdfToast}</span>
          <button
            onClick={() => setPdfToast(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

/* --- Component: Media Invitation (Bangla) --- */
const MediaInvitationBanglaView: React.FC<{ data: DocumentData }> = ({ data }) => {
  const rich=renderHtmlTemplate(data,'invitation-bn');
  if(rich!==null)return <div className="rich-document break-words leading-8" dangerouslySetInnerHTML={{__html:rich}}/>;
  const custom = renderTemplate(data, 'invitation-bn');
  if (custom !== null) return <div className="whitespace-pre-wrap break-words leading-8">{custom}</div>;
  const chiefGuestStr = formatChiefGuestBn(data.chiefGuest);

  return (
    <div className="font-bangla leading-relaxed space-y-5 text-[15px] text-slate-900">
      <div className="text-right text-slate-700 text-sm">
        তারিখঃ {data.issueDateBn || '২৮শে অক্টোবর, ২০২৫'}
      </div>

      <div className="text-slate-800">
        বরাবর,<br />
        <span className="font-semibold">{data.mediaAddresseeBn || 'প্রধান বার্তা সম্পাদক'}</span>
      </div>

      <div className="font-bold text-slate-900 text-base leading-snug">
        বিষয়: "{data.editionBn || data.eventTitleBn}" শীর্ষক আন্তর্জাতিক প্রদর্শনীর উদ্বোধনী অনুষ্ঠানে প্রতিবেদক ও ফটোসাংবাদিক পাঠানোর অনুরোধ।
      </div>

      <div className="text-slate-800">প্রিয় মহোদয়,</div>

      <p className="text-justify leading-7">
        <span className="font-semibold">{data.organizerBn || 'সেভার ইন্টারন্যাশনাল লিমিটেড'}</span>, আগামী{' '}
        <span className="font-bold bg-amber-50 px-1">{data.eventDateBn || '৩০শে অক্টোবর ২০২৫'}</span> তারিখে{' '}
        <span className="font-semibold">{data.inaugurationTimeBn || 'সকাল ১০.০০ ঘটিকায়'}</span>{' '}
        <span>{data.venueBn || 'ইন্টারন্যাশনাল কনভেনশন সিটি বসুন্ধরা (ICCB)'}</span>,{' '}
        {data.scopeBn || 'বাংলাদেশের সবচেয়ে বড় আন্তর্জাতিক মেরিটাইম ও অফশোর শিল্পের প্রদর্শনী'}{' '}
        <span className="font-bold">“{data.eventTitleBn}”</span> এর{' '}
        {data.editionBn ? `${data.editionBn} আসরের` : ''} উদ্বোধনের আয়োজন করতে যাচ্ছে।
      </p>

      <p className="text-justify leading-7">
        এই অনুষ্ঠানে প্রধান অতিথি হিসেবে{' '}
        <span className="font-bold text-slate-950 bg-blue-50/80 px-1 rounded">
          {chiefGuestStr || 'প্রধান অতিথি'}
        </span>{' '}
        উপস্থিত থেকে অনুষ্ঠান উদ্বোধন করবেন বলে বিশেষ সম্মতি প্রদান করেছেন। দেশ-বিদেশের বহু বিশিষ্ট ব্যক্তি ও প্রতিষ্ঠান এই গুরুত্বপূর্ণ প্রদর্শনীতে অংশগ্রহণ করবেন।
      </p>

      <div>
        <p className="font-semibold mb-2">এই আন্তর্জাতিক প্রদর্শনীতে প্রদর্শিত হবে—</p>
        <ul className="space-y-1.5 pl-6 list-disc text-slate-800">
          {data.highlights
            .filter((h) => h.textBn.trim())
            .map((h) => (
              <li key={h.id}>{h.textBn}</li>
            ))}
        </ul>
      </div>

      <p className="text-justify leading-7">
        প্রদর্শনীটি সংশ্লিষ্ট শিল্পের সাথে বৈশ্বিক বাজারের একটি অনন্য সেতুবন্ধন তৈরি করবে এবং বিনিয়োগ, প্রযুক্তি ও বাণিজ্য উন্নয়নে নতুন দিগন্ত উন্মোচন করবে।
      </p>

      <p className="text-justify leading-7">
        আপনার সম্মানিত সংবাদপত্র/সংবাদমাধ্যমের একজন প্রতিবেদক ও একজন ফটো সাংবাদিক পাঠিয়ে অনুষ্ঠানের সংবাদ প্রচারের জন্য বিনীতভাবে অনুরোধ জানাচ্ছি।
      </p>

      {/* Program Schedule Callout Box */}
      <div className="my-6 p-4 rounded-md bg-slate-100 border border-slate-300 text-sm space-y-1">
        <div className="font-bold underline text-slate-900 pb-1">অনুষ্ঠানসূচি</div>
        <div className="font-bold text-slate-900">
          উদ্বোধনী অনুষ্ঠান "{data.eventTitleBn}"
        </div>
        <div>
          <span className="font-medium text-slate-700">স্থান:</span> {data.venueBn}
        </div>
        <div>
          <span className="font-medium text-slate-700">তারিখ:</span>{' '}
          <span className="font-bold text-slate-900">{data.eventDateBn}</span>
        </div>
        <div>
          <span className="font-medium text-slate-700">সময়:</span>{' '}
          <span className="font-bold text-slate-900">{data.inaugurationTimeBn}</span>
        </div>
      </div>

      {/* Sender Sign-off */}
      <div className="pt-2 text-slate-800 leading-normal">
        <div className="font-bold text-slate-900">{data.sender.nameBn}</div>
        <div>{data.sender.designationBn}</div>
        <div>{data.sender.organizationBn}</div>
        <div>মোবাইল: {data.sender.phone}</div>
        {data.sender.email && <div>ইমেইল: {data.sender.email}</div>}
      </div>
    </div>
  );
};

/* --- Component: Media Invitation (English) --- */
const MediaInvitationEnglishView: React.FC<{ data: DocumentData }> = ({ data }) => {
  const rich=renderHtmlTemplate(data,'invitation-en');
  if(rich!==null)return <div className="rich-document break-words leading-8" dangerouslySetInnerHTML={{__html:rich}}/>;
  const custom = renderTemplate(data, 'invitation-en');
  if (custom !== null) return <div className="whitespace-pre-wrap break-words leading-8">{custom}</div>;
  const chiefGuestStr = formatChiefGuestEn(data.chiefGuest);

  return (
    <div className="font-english leading-relaxed space-y-5 text-[15px] text-slate-900">
      <div className="text-slate-700">
        Date: {data.issueDateEn || '28 October, 2025'}
      </div>

      <div className="text-slate-800">
        To,<br />
        <span className="font-semibold">{data.mediaAddresseeEn || 'Chief Reporter'}</span>
      </div>

      <div className="font-bold text-slate-900 text-base leading-snug">
        Subject: “Request to send Journalist to the inauguration ceremony of International Exhibition – "{data.editionEn || data.eventTitleEn}"
      </div>

      <div className="text-slate-800">Dear Sir/Madam,</div>

      <p className="text-justify leading-7">
        <span className="font-semibold">{data.organizerEn || 'Savor International Limited'}</span> is pleased to invite you to the{' '}
        <span className="font-bold">
          Inauguration Ceremony of the {data.editionEn || ''} of {data.eventTitleEn}
        </span>
        , scheduled to be held on{' '}
        <span className="font-bold bg-amber-50 px-1">
          {data.eventDateEn || '30 October 2025'} at {data.inaugurationTimeEn || '10:00 AM'}
        </span>{' '}
        at the {data.venueEn}.
      </p>

      <p className="text-justify leading-7">
        The event will be inaugurated by{' '}
        <span className="font-bold text-slate-950 bg-blue-50/80 px-1 rounded">
          {chiefGuestStr || 'Chief Guest'}
        </span>
        , with distinguished guests from government and private sectors, industry leaders, entrepreneurs, and international delegates in attendance.
      </p>

      <div>
        <p className="font-bold mb-2">The exhibition will feature:</p>
        <ul className="space-y-1.5 pl-6 list-disc text-slate-800">
          {data.highlights
            .filter((h) => h.textEn.trim())
            .map((h) => (
              <li key={h.id}>{h.textEn}</li>
            ))}
        </ul>
      </div>

      <p className="text-justify leading-7">
        This international exhibition will create a unique platform connecting Bangladesh’s industry with the global market, opening new opportunities in investment, technology, and trade.
      </p>

      <p className="text-justify leading-7">
        We sincerely request your esteemed media house to kindly send a reporter and a photojournalist to cover the event.
      </p>

      {/* Program Schedule Box with highlight */}
      <div className="my-6 p-4 rounded-md bg-amber-50/60 border border-amber-200 text-sm space-y-1">
        <div className="font-bold text-slate-900 pb-1">Program Schedule</div>
        <div className="font-bold text-slate-900">
          Inaugural Ceremony "{data.editionEn ? data.editionEn + ' ' : ''}{data.eventTitleEn}"
        </div>
        <div>
          <span className="font-medium text-slate-700">Place:</span> {data.venueEn}
        </div>
        <div>
          <span className="font-medium text-slate-700">Date:</span>{' '}
          <span className="font-bold text-slate-900 bg-yellow-200/60 px-1">
            {data.eventDateEn}
          </span>
        </div>
        <div>
          <span className="font-medium text-slate-700">Time:</span>{' '}
          <span className="font-bold text-slate-900 bg-yellow-200/60 px-1">
            {data.inaugurationTimeEn}
          </span>
        </div>
      </div>

      {/* Sender Sign-off */}
      <div className="pt-2 text-slate-800 leading-normal">
        <div className="font-bold text-slate-900">{data.sender.nameEn}</div>
        <div className="font-semibold text-slate-800">{data.sender.designationEn}</div>
        <div>{data.sender.organizationEn}</div>
        <div>RSVP: {data.sender.phone}</div>
        {data.sender.email && <div>Email: {data.sender.email}</div>}
      </div>
    </div>
  );
};

/* --- Component: Press Release (Bangla) --- */
const PressReleaseBanglaView: React.FC<{ data: DocumentData }> = ({ data }) => {
  const rich=renderHtmlTemplate(data,'press-release-bn');
  if(rich!==null)return <div className="rich-document break-words leading-8" dangerouslySetInnerHTML={{__html:rich}}/>;
  const custom = renderTemplate(data, 'press-release-bn');
  if (custom !== null) return <div className="whitespace-pre-wrap break-words leading-8">{custom}</div>;
  const chiefGuestStr = formatChiefGuestBn(data.chiefGuest);
  const specialGuestsStr = formatSpecialGuestsBn(data.specialGuests);
  const highlightSummary = data.highlights
    .filter((h) => h.textBn.trim())
    .map((h) => h.textBn)
    .join(', ');

  return (
    <div className="font-bangla leading-relaxed space-y-5 text-[15px] text-slate-900">
      <div className="text-slate-700 text-sm">
        {data.eventDateBn || '৩০ অক্টোবর, ২০২৫'}
      </div>

      <div className="text-center font-bold text-2xl text-slate-900 tracking-wide underline underline-offset-8 py-2">
        সংবাদ বিজ্ঞপ্তি
      </div>

      <p className="text-justify leading-7">
        <span className="font-semibold">আজ {data.eventDateBn || '৩০ অক্টোবর ২০২৫'}</span>,{' '}
        <span className="font-medium">{data.organizerBn}</span>-এর আয়োজনে{' '}
        <span>{data.venueBn}</span>-এ অনুষ্ঠিত হলো {data.scopeBn}{' '}
        <span className="font-bold">“{data.editionBn || data.eventTitleBn}”</span>–এর উদ্বোধনী অনুষ্ঠান।
      </p>

      {highlightSummary && (
        <p className="text-justify leading-7">
          {highlightSummary} প্রযুক্তিকে কেন্দ্র করে আয়োজিত এই প্রদর্শনীতে অংশ নিচ্ছে দেশি-বিদেশি শীর্ষস্থানীয় কোম্পানি, বিনিয়োগকারী, প্রযুক্তিবিদ ও ব্যবসায়ী প্রতিনিধি দল।
        </p>
      )}

      {/* Chief Guest & Special Guests Paragraph */}
      <p className="text-justify leading-7 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
        প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি{' '}
        <span className="font-bold text-slate-950 bg-blue-100/70 px-1 rounded">
          {chiefGuestStr || 'প্রধান অতিথি'}
        </span>
        ।{' '}
        {specialGuestsStr ? (
          <>
            বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন{' '}
            <span className="font-semibold text-slate-900">
              {specialGuestsStr}
            </span>
            ।
          </>
        ) : (
          'অনুষ্ঠানে দেশি-বিদেশি বিশিষ্ট অতিথিবৃন্দ উপস্থিত ছিলেন।'
        )}
      </p>

      <p className="text-justify leading-7">
        প্রদর্শনীতে বিভিন্ন সর্বাধুনিক প্রযুক্তি ও উদ্ভাবন প্রদর্শনের পাশাপাশি আন্তর্জাতিক B2B ও B2G মিটিং, সেমিনার ও প্যানেল আলোচনা অনুষ্ঠিত হচ্ছে, যেখানে শীর্ষ ব্যক্তিবর্গ অংশ নিচ্ছেন।
      </p>

      <p className="text-justify leading-7 font-medium">
        এই প্রদর্শনী <span className="font-bold text-slate-950">{data.eventDurationBn || data.eventDateBn}</span> পর্যন্ত{' '}
        <span className="font-bold text-slate-950">{data.visitingHoursBn || 'প্রতিদিন সকাল ১০টা থেকে সন্ধ্যা ৭টা পর্যন্ত'}</span>{' '}
        সকল দর্শকের জন্য উন্মুক্ত থাকবে।
      </p>

      {/* Message Sender */}
      <div className="pt-4 text-slate-800 leading-normal border-t border-slate-200">
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">
          বার্তা প্রেরক
        </div>
        <div className="font-bold text-slate-900 text-base">{data.sender.nameBn}</div>
        <div>{data.sender.designationBn}</div>
        <div>{data.sender.organizationBn}</div>
        <div>মোবাইল: {data.sender.phone}</div>
        {data.sender.email && <div>ইমেইল: {data.sender.email}</div>}
      </div>
    </div>
  );
};

/* --- Component: Press Release (English) --- */
const PressReleaseEnglishView: React.FC<{ data: DocumentData }> = ({ data }) => {
  const rich=renderHtmlTemplate(data,'press-release-en');
  if(rich!==null)return <div className="rich-document break-words leading-8" dangerouslySetInnerHTML={{__html:rich}}/>;
  const custom = renderTemplate(data, 'press-release-en');
  if (custom !== null) return <div className="whitespace-pre-wrap break-words leading-8">{custom}</div>;
  const chiefGuestStr = formatChiefGuestEn(data.chiefGuest);
  const specialGuestsStr = formatSpecialGuestsEn(data.specialGuests);
  const highlightSummary = data.highlights
    .filter((h) => h.textEn.trim())
    .map((h) => h.textEn.toLowerCase())
    .join(', ');

  return (
    <div className="font-english leading-relaxed space-y-5 text-[15px] text-slate-900">
      <div className="text-slate-700 text-sm">
        {data.eventDateEn || '30 October, 2025'}
      </div>

      <div className="text-center font-bold text-2xl text-slate-900 tracking-wide underline underline-offset-8 py-2">
        PRESS RELEASE
      </div>

      <p className="text-justify leading-7">
        The inauguration ceremony of{' '}
        <span className="font-bold">"{data.eventTitleEn}"</span>, {data.scopeEn}, was held today,{' '}
        <span className="font-semibold">{data.eventDateEn || 'October 30, 2025'}</span>, at the{' '}
        <span>{data.venueEn}</span>. The event has been organized by{' '}
        <span className="font-semibold">{data.organizerEn}</span>.
      </p>

      {highlightSummary && (
        <p className="text-justify leading-7">
          Focused on {highlightSummary}, the exhibition brings together leading companies from home and abroad, along with investors, technologists, and business representatives.
        </p>
      )}

      {/* Chief Guest & Special Guests Paragraph */}
      <p className="text-justify leading-7 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
        The exhibition was inaugurated by{' '}
        <span className="font-bold text-slate-950 bg-blue-100/70 px-1 rounded">
          {chiefGuestStr || 'Chief Guest'}
        </span>
        .{' '}
        {specialGuestsStr ? (
          <>
            Special Guests included{' '}
            <span className="font-semibold text-slate-900">
              {specialGuestsStr}
            </span>
            .
          </>
        ) : (
          'Special dignitaries and delegates attended the inauguration.'
        )}
      </p>

      <p className="text-justify leading-7">
        The exhibition features the latest innovations and technologies, along with international B2B and B2G meetings, seminars, and panel discussions, with active participation from top industry leaders from Bangladesh and the global maritime sector.
      </p>

      <p className="text-justify leading-7 font-medium">
        The exhibition is open to all visitors from{' '}
        <span className="font-bold text-slate-950">{data.eventDurationEn || data.eventDateEn}</span>,{' '}
        <span className="font-bold text-slate-950">{data.visitingHoursEn || 'daily from 10:00 AM to 7:00 PM'}</span>.
      </p>

      {/* Message Sender */}
      <div className="pt-4 text-slate-800 leading-normal border-t border-slate-200">
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">
          Message sender
        </div>
        <div className="font-bold text-slate-900 text-base">{data.sender.nameEn}</div>
        <div className="font-semibold text-slate-800">{data.sender.designationEn}</div>
        <div>{data.sender.organizationEn}</div>
        <div>RSVP: {data.sender.phone}</div>
        {data.sender.email && <div>Email: {data.sender.email}</div>}
      </div>
    </div>
  );
};
