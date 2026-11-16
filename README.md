# SAVOR Media Studio

Bangla and English media invitations and press releases for Savor International Limited.

## Features

- Four independent Word, TXT or HTML uploads: invitation Bangla/English and press release Bangla/English.
- Example documents (BIMOX 2026, in `public/examples/`): load all four at once or pick one per slot to try the app without your own files.
- Submit uploads as a new set, replacing the previous documents.
- Shared chief and special guest fields update live document previews.
- English-first event, date/time, venue, highlight and sender fields with editable Bangla.
- Translation dropdown: Offline automatic drafts or Google Gemini with review and apply.
- HTML Visual Editor: selected-text fonts, sizes, bold/italic/underline, colors, highlighting, alignment and lists.
- Browser-local autosave, JSON draft backup, clipboard copy, HTML download, Word export, PDF and print controls.
- Custom page margins in inches (top/right/bottom/left, with presets) applied to print, PDF download and Word export; the preview shows the same margins. Saved in the browser.

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

## WordPress plugin (snapshot-bd.com/media-studio)

`wordpress-plugin/savor-media-studio` serves the app from a WordPress site at an unlisted address (default `/media-studio/`, changeable in **Settings → Media Studio**). There is no login: anyone with the address can use it, it is not linked from the site, and it sends `noindex` to search engines.

- **File manager with autosave:** the dark bar under the header opens the file manager. Create folders and files, open a file, and every change saves to the server about a second after you stop typing (Ctrl+S saves immediately). Each file keeps its last 30 automatic versions (one every 5 minutes) and deleted items stay in the server trash for 30 days. Files live in `wp-content/uploads/savor-media-studio/`, which is blocked from direct download; the API only accepts validated `.json` project files.
- **Gemini:** add the API key in **Settings → Media Studio** (or `define('SMS_GEMINI_API_KEY', '...')` in `wp-config.php`). Because the studio is public, translation is rate limited per visitor and per day, and you can require a passcode. Offline translation always works.
- **Releases and updates:** every push to `main` runs `.github/workflows/wordpress-plugin.yml`, which tests, builds `savor-media-studio.zip`, publishes a `wp-vX.Y.Z` GitHub release and copies the zip to the `wp-plugin-build` branch. Installed sites see it as a normal plugin update in **Dashboard → Updates**.
- **Local build:** `npm run build:wp`, then zip the `wordpress-plugin/savor-media-studio` folder.

## GitHub Pages

The Pages workflow builds only the frontend into `pages-dist` with the repository base path. In Settings → Pages choose GitHub Actions. Pushes to `main` trigger deployment. Offline works directly on Pages; Gemini uses the authenticated Supabase backend configured below. No Gemini API key is included in the Pages build.

## Supabase translation backend

GitHub Pages can use `supabase/functions/media-translate` with authenticated Supabase user sessions. The deployed function requires JWT verification and restricts translation access to the configured owner user IDs. `GEMINI_API_KEY` must be configured as a Supabase Edge Function secret. It is never a frontend variable. Configure the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` build values. The app uses existing Supabase app email/password accounts; Dashboard credentials are separate. Offline mode works without login.
