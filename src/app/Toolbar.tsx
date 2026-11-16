import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Braces, ChevronDown, Eraser, Highlighter, Indent, Italic,
  Link2, List, ListOrdered, Minus, Outdent, Plus, Redo2, Rows3, SeparatorHorizontal, Strikethrough, Table, TextCursorInput, Underline, Undo2,
} from 'lucide-react';
import { EditorApi, ToolbarState } from './VisualEditor';
import { FONTS } from '../editor/doc';
import { FIELDS } from '../editor/fields';
import { Button, IconButton, Menu, MenuItem, Separator, cn, inputClass } from '../ui/ui';

const BLOCKS = [
  { value: 'p', label: 'Normal text' },
  { value: 'h1', label: 'Title' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
  { value: 'blockquote', label: 'Quote' },
];
const SIZES = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const SWATCHES = ['#000000', '#3f3f46', '#71717a', '#a1a1aa', '#ffffff', '#b91c1c', '#c2410c', '#a16207', '#15803d', '#0f766e', '#1d4ed8', '#4338ca', '#7e22ce', '#be185d', '#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fbcfe8'];

function Popover({ open, onClose, anchor, children }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLElement>; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!open || !anchor.current) return null;
  const r = anchor.current.getBoundingClientRect();
  return createPortal(
    <div ref={box} style={{ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 280) }} className="fixed z-50 w-[264px] animate-in rounded-xl border border-zinc-200 bg-white p-3 shadow-pop">{children}</div>,
    document.body,
  );
}

function ColorButton({ label, icon, onPick }: { label: string; icon: React.ReactNode; onPick: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(label === 'Text color' ? '#b91c1c' : '#fde68a');
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton ref={anchor} label={label} onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)} className="relative">
        {icon}<span className="absolute bottom-1 left-2 right-2 h-[3px] rounded-full" style={{ background: last }} />
      </IconButton>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor}>
        <p className="mb-2 text-xs font-medium text-zinc-500">{label}</p>
        <div className="grid grid-cols-10 gap-1.5">
          {SWATCHES.map(c => (
            <button key={c} aria-label={c} title={c} onMouseDown={e => e.preventDefault()} onClick={() => { setLast(c); onPick(c); setOpen(false); }}
              className="size-5 rounded-full ring-1 ring-zinc-200 transition-transform hover:scale-110" style={{ background: c }} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input type="color" aria-label="Custom colour" value={last} onChange={e => setLast(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-zinc-200 bg-white" />
          <Button size="sm" variant="outline" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(last); setOpen(false); }}>Apply custom</Button>
          {label === 'Highlight' && <Button size="sm" variant="ghost" onMouseDown={e => e.preventDefault()} onClick={() => { onPick('transparent'); setOpen(false); }}>None</Button>}
        </div>
      </Popover>
    </>
  );
}

function LinkButton({ api }: { api: React.RefObject<EditorApi | null> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('https://');
  const anchor = useRef<HTMLButtonElement>(null);
  const apply = () => {
    const v = url.trim();
    if (/^(https?:\/\/|mailto:|tel:)/i.test(v) && v.length > 8) api.current?.exec('createLink', v);
    setOpen(false);
  };
  return (
    <>
      <IconButton ref={anchor} label="Link" onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}><Link2 className="size-4" /></IconButton>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor}>
        <form onSubmit={e => { e.preventDefault(); apply(); }} className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">Link selected text to</p>
          <input autoFocus className={inputClass} value={url} onChange={e => setUrl(e.target.value)} aria-label="Link address" />
          <div className="flex justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={() => { api.current?.exec('unlink'); setOpen(false); }}>Remove link</Button>
            <Button size="sm" variant="primary" type="submit">Apply</Button>
          </div>
        </form>
      </Popover>
    </>
  );
}

interface Props {
  api: React.RefObject<EditorApi | null>;
  state: ToolbarState;
  fieldValue: (key: string) => string;
  onFieldLinked: (key: string, text: string) => void;
  disabled?: boolean;
}

export function Toolbar({ api, state, fieldValue, onFieldLinked, disabled }: Props) {
  const ex = (cmd: string, value?: string) => api.current?.exec(cmd, value);
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const tb = (label: string, icon: React.ReactNode, on: () => void, active?: boolean, shortcut?: string) => (
    <IconButton label={label} shortcut={shortcut} active={active} onMouseDown={keep} onClick={on}>{icon}</IconButton>
  );
  const fontMatch = FONTS.find(f => f.value.split(',')[0].replace(/['"]/g, '').trim().toLowerCase() === state.font.toLowerCase());
  const changeSize = (delta: number) => {
    const i = SIZES.findIndex(s => s >= state.size);
    const next = delta > 0 ? SIZES[Math.min(SIZES.length - 1, i < 0 ? SIZES.length - 1 : (SIZES[i] === state.size ? i + 1 : i))] : SIZES[Math.max(0, (i < 0 ? SIZES.length : i) - 1)];
    api.current?.setFontSize(next);
  };

  const fieldItems: MenuItem[] = [
    { label: state.hasSelection ? 'Link selected text to…' : 'Insert field', heading: true },
    ...FIELDS.map(f => ({
      label: f.label,
      hint: state.hasSelection ? 'link' : undefined,
      onSelect: () => {
        if (state.hasSelection) { const t = api.current?.linkSelectionToField(f.key); if (t) onFieldLinked(f.key, t); }
        else api.current?.insertHtml(`<span data-field="${f.key}">${(fieldValue(f.key) || `[${f.label}]`).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>&nbsp;`);
      },
    })),
  ];

  const tableItems: MenuItem[] = [
    { label: 'Insert 2 × 2 table', icon: <Table />, onSelect: () => api.current?.insertHtml(tableHtml(2, 2)) },
    { label: 'Insert 3 × 3 table', icon: <Table />, onSelect: () => api.current?.insertHtml(tableHtml(3, 3)) },
    { label: 'Insert 4 × 4 table', icon: <Table />, onSelect: () => api.current?.insertHtml(tableHtml(4, 4)) },
    { label: 'Insert table without borders', icon: <Rows3 />, onSelect: () => api.current?.insertHtml(tableHtml(2, 2, true)) },
    { separator: true, label: '' },
    { label: 'Row above', disabled: !state.inTable, onSelect: () => api.current?.tableAction('row-above') },
    { label: 'Row below', disabled: !state.inTable, onSelect: () => api.current?.tableAction('row-below') },
    { label: 'Column left', disabled: !state.inTable, onSelect: () => api.current?.tableAction('col-left') },
    { label: 'Column right', disabled: !state.inTable, onSelect: () => api.current?.tableAction('col-right') },
    { label: 'Delete row', disabled: !state.inTable, onSelect: () => api.current?.tableAction('del-row') },
    { label: 'Delete column', disabled: !state.inTable, onSelect: () => api.current?.tableAction('del-col') },
    { label: 'Delete table', danger: true, disabled: !state.inTable, onSelect: () => api.current?.tableAction('del-table') },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className={cn('no-scrollbar flex h-11 items-center gap-0.5 overflow-x-auto border-b border-zinc-200 bg-white px-3', disabled && 'pointer-events-none opacity-50')}>
      {tb('Undo', <Undo2 className="size-4" />, () => ex('undo'), false, 'Ctrl+Z')}
      {tb('Redo', <Redo2 className="size-4" />, () => ex('redo'), false, 'Ctrl+Y')}
      <Separator vertical />
      <select aria-label="Text style" value={BLOCKS.some(b => b.value === state.block) ? state.block : 'p'} onChange={e => api.current?.setBlock(e.target.value)}
        className="h-8 w-[124px] shrink-0 rounded-md border-0 bg-transparent px-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-200">
        {BLOCKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
      <select aria-label="Font" value={fontMatch?.value || ''} onChange={e => e.target.value && ex('fontName', e.target.value)}
        className="h-8 w-[150px] shrink-0 rounded-md border-0 bg-transparent px-2 text-[13px] text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-200">
        <option value="">{fontMatch ? fontMatch.label : state.font || 'Font'}</option>
        {FONTS.map(f => <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
      </select>
      <Separator vertical />
      {tb('Smaller text', <Minus className="size-3.5" />, () => changeSize(-1))}
      <select aria-label="Font size" value={SIZES.includes(state.size) ? String(state.size) : ''} onChange={e => e.target.value && api.current?.setFontSize(Number(e.target.value))}
        className="h-8 w-[58px] shrink-0 rounded-md border border-zinc-200 bg-white px-1.5 text-center text-[13px] tabular-nums text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-200">
        {!SIZES.includes(state.size) && <option value="">{state.size}</option>}
        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {tb('Larger text', <Plus className="size-3.5" />, () => changeSize(1))}
      <Separator vertical />
      {tb('Bold', <Bold className="size-4" />, () => ex('bold'), state.bold, 'Ctrl+B')}
      {tb('Italic', <Italic className="size-4" />, () => ex('italic'), state.italic, 'Ctrl+I')}
      {tb('Underline', <Underline className="size-4" />, () => ex('underline'), state.underline, 'Ctrl+U')}
      {tb('Strikethrough', <Strikethrough className="size-4" />, () => ex('strikeThrough'), state.strike)}
      <ColorButton label="Text color" icon={<Baseline className="size-4" />} onPick={c => ex('foreColor', c)} />
      <ColorButton label="Highlight" icon={<Highlighter className="size-4" />} onPick={c => ex('hiliteColor', c)} />
      <Separator vertical />
      {tb('Align left', <AlignLeft className="size-4" />, () => ex('justifyLeft'), state.align === 'left')}
      {tb('Center', <AlignCenter className="size-4" />, () => ex('justifyCenter'), state.align === 'center')}
      {tb('Align right', <AlignRight className="size-4" />, () => ex('justifyRight'), state.align === 'right')}
      {tb('Justify', <AlignJustify className="size-4" />, () => ex('justifyFull'), state.align === 'justify')}
      <Separator vertical />
      {tb('Bulleted list', <List className="size-4" />, () => ex('insertUnorderedList'), state.ul)}
      {tb('Numbered list', <ListOrdered className="size-4" />, () => ex('insertOrderedList'), state.ol)}
      {tb('Decrease indent', <Outdent className="size-4" />, () => ex('outdent'), false, 'Shift+Tab')}
      {tb('Increase indent', <Indent className="size-4" />, () => ex('indent'), false, 'Tab')}
      <Separator vertical />
      <LinkButton api={api} />
      <Menu width="w-56" items={tableItems} trigger={p => <IconButton label="Table" {...p} onMouseDown={keep}><Table className="size-4" /></IconButton>} />
      {tb('Horizontal line', <Minus className="size-4" />, () => ex('insertHorizontalRule'))}
      {tb('Page break', <SeparatorHorizontal className="size-4" />, () => api.current?.insertHtml('<hr class="sv-page-break"><p><br></p>'))}
      <Menu width="w-64" items={fieldItems} trigger={p => (
        <Button size="sm" variant="ghost" {...p} onMouseDown={keep} title="Insert a linked field, or link selected text to a field" className="ml-0.5">
          {state.hasSelection ? <Braces className="size-4" /> : <TextCursorInput className="size-4" />} Field <ChevronDown className="size-3.5 text-zinc-400" />
        </Button>
      )} />
      <Separator vertical />
      {tb('Clear formatting', <Eraser className="size-4" />, () => ex('removeFormat'))}
    </div>
  );
}

function tableHtml(rows: number, cols: number, plain = false): string {
  const cell = '<td><br></td>';
  return `<table${plain ? ' class="sv-plain"' : ''} style="border-collapse:collapse;width:100%">${Array.from({ length: rows }, () => `<tr>${cell.repeat(cols)}</tr>`).join('')}</table><p><br></p>`;
}
