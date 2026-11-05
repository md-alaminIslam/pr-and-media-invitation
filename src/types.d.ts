declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: any[];
  }

  export function extractRawText(options: { arrayBuffer?: ArrayBuffer; buffer?: Buffer; path?: string }): Promise<MammothResult>;
  export function convertToHtml(options: { arrayBuffer?: ArrayBuffer; buffer?: Buffer; path?: string }): Promise<MammothResult>;
}

declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[] | [number, number] | [number, number, number, number];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; logging?: boolean };
    jsPDF?: { unit?: string; format?: string; orientation?: string };
    pagebreak?: { mode?: string | string[] };
  }

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement | string): Html2PdfWorker;
    save(): Promise<void>;
    outputPdf(type?: string): Promise<any>;
  }

  function html2pdf(): Html2PdfWorker;
  function html2pdf(element: HTMLElement | string, options?: Html2PdfOptions): Html2PdfWorker;

  export default html2pdf;
}
