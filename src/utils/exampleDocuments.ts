import { SingleDocumentType } from './templates';

/** Sample documents (served from public/examples) so users can try the app without their own files. */
export interface ExampleDocument { type: SingleDocumentType; filename: string; title: string; }

export const EXAMPLE_SET_NAME = 'BIMOX 2026';

export const EXAMPLE_DOCUMENTS: ExampleDocument[] = [
  { type: 'invitation-bn', filename: 'BIMOX_2026_Media_Invitation_Bangla.docx', title: 'মিডিয়া ইনভিটেশন — বাংলা' },
  { type: 'invitation-en', filename: 'BIMOX_2026_Media_Invitation_English.docx', title: 'Media Invitation — English' },
  { type: 'press-release-bn', filename: 'BIMOX_2026_Press_Release_Bangla.docx', title: 'প্রেস রিলিজ — বাংলা' },
  { type: 'press-release-en', filename: 'BIMOX_2026_Press_Release_English.docx', title: 'Press Release — English' },
];

/** URL of an example file, respecting the deploy base path (e.g. /pr-and-media-invitation/ on GitHub Pages). */
export function exampleUrl(doc: ExampleDocument, base: string = import.meta.env?.BASE_URL ?? '/'): string {
  return `${base.endsWith('/') ? base : base + '/'}examples/${encodeURIComponent(doc.filename)}`;
}

/** Download an example and wrap it as a File so it goes through the normal upload parser. */
export async function fetchExampleFile(doc: ExampleDocument, fetcher: typeof fetch = fetch): Promise<File> {
  const res = await fetcher(exampleUrl(doc));
  if (!res.ok) throw new Error(`উদাহরণ ফাইল লোড হয়নি (${res.status}): ${doc.filename}`);
  return new File([await res.blob()], doc.filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
