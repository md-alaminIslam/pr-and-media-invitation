# SAVOR Media Studio

Bangla and English media invitations and press releases for Savor International Limited.

## Features

- Four independent Word, TXT or HTML uploads: invitation Bangla/English and press release Bangla/English.
- Submit uploads as a new set, replacing the previous documents.
- Shared chief and special guest fields update live document previews.
- English-first event, date/time, venue, highlight and sender fields with editable Bangla.
- Translation dropdown: Offline automatic drafts or Google Gemini with review and apply.
- HTML Visual Editor: selected-text fonts, sizes, bold/italic/underline, colors, highlighting, alignment and lists.
- Browser-local autosave, JSON draft backup, clipboard copy, HTML download, Word export, PDF and print controls.

## Local development

Requires Node.js with npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The Vite server runs the frontend and Offline translator. Gemini requires the protected Worker API described below; the Vite server does not supply that endpoint.

```sh
npm test
npx tsc --noEmit
npm run build
```

The build emits `dist/server/index.js`, a Cloudflare-compatible module Worker containing the frontend assets and API routes. `.openai/hosting.json` is a neutral build manifest without the deployed Site identity.

## Gemini and production hosting

The Worker serves `/api/translate` and `/api/translation-status`. Configure `GEMINI_API_KEY` as a **server-side secret**. Optional `GEMINI_MODEL` selects a model explicitly; otherwise a supported Flash model is discovered if the default is unavailable.

Deploy behind authenticated, owner-only access. The existing app uses its hosting platform's access controls; this source export does not embed those access settings. Other hosting environments must enforce authentication and appropriate request limits before exposing the API.

Never put a real API key in browser code, `.env.example`, Git commits, or frontend environment variables. No API key or live hosting credentials are included in this repository.

Gemini sends English bilingual form fields for translation. Review results before applying them. Fields edited while a request is pending are preserved. Offline mode uses a local dictionary and rules. Verify personal-name spellings before publication.

## Document behavior and limitations

HTML import keeps supported inline formatting, lists and simple tables. Scripts, external stylesheets, external media and interactive elements are removed. Word/TXT import extracts plain text. HTML previews and PDF output use supported formatting; Word export supports common text formatting and flattens complex table layouts. Full browser download verification for Word/PDF remains incomplete.

Drafts stay in the current browser. Back up important work with the draft backup button. Unused sample PDF/image assets are omitted.

`server.ts` is the retained original optional AI development backend. The current production translation endpoint is `worker/translate.js`.

## GitHub Pages

The Pages workflow builds only the frontend into `pages-dist` with the repository base path. In Settings → Pages choose GitHub Actions. Pushes to `main` trigger deployment. The Pages app uses Offline translation; Gemini remains available in the separately hosted authenticated app. No API key is needed for Pages.
