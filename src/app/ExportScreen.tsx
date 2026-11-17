import React, { useEffect, useState } from 'react';
import { Download, FileDown, FileType2, Printer } from 'lucide-react';
import { DocModel, parseDoc } from '../editor/doc';
import { downloadDocx, downloadHtml, downloadPdf, printDoc } from '../editor/export';
import { Store } from '../editor/store';
import { Button, Spinner } from '../ui/ui';

export type ExportFormat = 'pdf' | 'word' | 'print' | 'html';

/** Opened from an export link (e.g. made by the AI connector): makes the file with the studio's own exporter. */
export function ExportScreen({ store, path, format, onHome }: { store: Store; path: string; format: ExportFormat; onHome: () => void }) {
  const [model, setModel] = useState<DocModel | null>(null);
  const [state, setState] = useState<'loading' | 'working' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');

  const run = async (m: DocModel, f: ExportFormat) => {
    setState('working');
    try {
      if (f === 'pdf') await downloadPdf(m);
      else if (f === 'word') await downloadDocx(m);
      else if (f === 'html') downloadHtml(m);
      else await printDoc(m);
      setState('done');
    } catch (e: any) { setError(e?.message || 'Export failed.'); setState('error'); }
  };

  useEffect(() => {
    let alive = true;
    store.read(path).then(r => {
      if (!alive) return;
      const m = parseDoc(r.content, path.split('/').pop()!.replace(/\.html$/i, ''));
      setModel(m);
      void run(m, format);
    }).catch(e => { setError(e?.message || 'Document not found.'); setState('error'); });
    return () => { alive = false; };
  }, [path, format]);

  const name = path.split('/').pop()!.replace(/\.html$/i, '');
  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-pop">
        <p className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">Export</p>
        <h1 className="mt-1 text-[17px] font-semibold text-zinc-900">{name}</h1>
        <p className="mt-2 flex items-center gap-2 text-[13px] text-zinc-600">
          {state === 'loading' || state === 'working' ? <><Spinner className="size-4" />Preparing the {format === 'word' ? 'Word file' : format === 'print' ? 'print view' : format.toUpperCase()}…</>
            : state === 'done' ? (format === 'print' ? 'The print dialog opened. Choose "Save as PDF" for a PDF.' : 'Downloaded. It looks exactly like the print preview.')
              : <span className="text-red-600">{error}</span>}
        </p>
        {model && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => void run(model, 'pdf')}><FileDown className="size-4" />PDF</Button>
            <Button size="sm" onClick={() => void run(model, 'word')}><FileType2 className="size-4" />Word</Button>
            <Button size="sm" onClick={() => void run(model, 'print')}><Printer className="size-4" />Print</Button>
            <Button size="sm" variant="ghost" onClick={() => run(model, 'html')}><Download className="size-4" />HTML</Button>
          </div>
        )}
        <button onClick={onHome} className="mt-5 text-[12.5px] text-indigo-600 hover:underline">Open the studio</button>
      </div>
    </div>
  );
}
