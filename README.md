# Leap Into Journalling

A local-first React journal built from `Instructions.md`. Soft mint surfaces, botanical illustrations, Lora headings, and a scrapbook writing page give each moment a little room.

## Run locally

Use Node.js 22 LTS and npm. `.nvmrc` and `package.json` select the same Node major version for local development and Vercel builds.

```sh
nvm use            # If you use nvm; install Node 22 first with nvm install
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). Camera and microphone recording require localhost or HTTPS. No API keys or backend services are needed.

```sh
npm run build       # Typecheck and create dist/
npm run preview     # Preview the production build
npm test           # Analysis, prompts, and IndexedDB tests
npx playwright test # With the dev server running; uses installed Google Chrome
```

Browser tests use synthetic camera/microphone input and isolated browser profiles. They never open your real camera or microphone. For another Chromium install, change `launchOptions.channel` in `playwright.config.ts`.

## Deploy to Vercel

1. Open [New Project in Vercel](https://vercel.com/new) and import the private GitHub repository `wildfellhall/LeapIntoJournalling`. Grant Vercel access to that repository if it is not listed.
2. Keep the root directory at the repository root (`./`) and select the `main` production branch. The checked-in `vercel.json` supplies these settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Vite |
   | Install command | `npm ci` |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Node.js version | 22.x (from `package.json`) |
   | Environment variables | None required |

3. Click **Deploy**. The prebuild step copies the local expression models from the installed dependency into the production assets automatically. Fonts and illustrations are also included in the build.

The SPA rewrite follows [Vercel's Vite guidance](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas). The app currently selects its pages in memory, so refreshing returns to Your space. No server functions, database provisioning, API keys, or hosting plugins are needed.

After deployment, use the app's HTTPS URL for camera and microphone access. Journal storage is specific to each origin: export a backup from localhost, then restore it on the deployed URL to move your entries. A private GitHub repository does not make the deployed app private; configure Vercel's deployment protection if needed.

## Included

- Writing journal with four fonts, four paper colors, page highlighting, removable stickers, sticky notes, mood check-ins, entry dates, and debounced text draft autosave.
- Video and voice recording, up to ten minutes per entry, with playback, duration, downloadable recordings, and editable transcripts. Unsaved recording navigation prompts prevent accidental loss.
- 120 writing prompts and 520 shared video/voice prompts, built from curated subjects and reflection frames. Shuffle avoids immediately repeating the same prompt.
- Optional camera expression estimates in every mode. Voice mode saves only the audio track. Writing mode saves expression measurements, not camera footage.
- Optional live English transcription where the browser supports Web Speech recognition. It is off by default; the interface explains that the browser may send audio to its speech service. Manual transcripts work in every mode.
- IndexedDB stores entry text, decoration, sentiment, expression samples, acoustic measurements, and recording blobs atomically. Search, mode/mood filters, entry details, and confirmed deletion are included.
- Full JSON backup and restore include recordings. Restore validates all records before committing and merges by ID. Individual recordings can also be downloaded.
- A responsive, keyboard-operable graph with date lookup, entry selection, zoom, shared keywords, and ranked matches. A maximum of 30 nodes is displayed around the selected entry; all entries remain selectable and participate in ranking.
- Daily mood line chart, self-reported mood distribution, average word count by mood, recurring keywords, and date filters.
- An explicitly labeled sample journal that never enters personal storage or backups.

## How the signals work

Text sentiment is a small, local English lexicon with negation handling. It is a baseline, not a language model; it can miss context, sarcasm, and languages other than English. A user's mood check-in takes precedence over the text score in the graph and charts.

Connections combine TF–IDF word similarity (65%) with mood proximity (35%). When both entries contain facial-expression samples, expression cosine similarity contributes 10% and mood contributes 25%. Weights and the estimate limitations are explained in the interface.

Facial-expression inference uses [`@vladmandic/human`](https://github.com/vladmandic/human). Only the face detector and emotion model are enabled; age, gender, identity, body, and hand models are disabled. The build copies the required model files into `public/models/`, so journal data never goes to a model CDN. See the [upstream model credits](https://github.com/vladmandic/human/wiki/Models). The JS model bundle loads only after the user enables camera analysis. Expression predictions can be wrong and do not establish someone's emotional state.

Voice energy is measured with Web Audio RMS and retained as an acoustic observation. It is **not** labeled as emotional sentiment or used as such in the graph. A validated voice-emotion classifier is not included. The transcript and optional camera estimates provide the requested emotional inputs for spoken entries.

## Privacy and storage limits

- No journal backend, analytics, cloud sync, or accounts. This browser's origin is the storage boundary; local development and a hosted version have separate journals. Use backup/restore to move data.
- Data is not encrypted. Anyone with access to this browser profile may access the journal. Backups are also unencrypted.
- Clearing site data or browser storage eviction can remove entries. Download backups regularly. Imports are limited to 100 MB; media storage depends on the browser's quota.
- Text drafts autosave locally. Media recordings remain in memory until **Complete entry**; reloading or closing the tab can lose an unsaved recording even if a browser warning appears.
- Browser speech recognition availability, network requirements, and privacy behavior vary. See [MDN's SpeechRecognition documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). A manual transcript is always available.
- Automated checks cover Chrome with synthetic media, local model loading, storage persistence, backups, failure recovery, and mobile layout. Real speech-service accuracy, real facial-expression accuracy, and other browsers require device testing.

## Project layout

`src/App.tsx` contains the application shell and journal library. `src/components/` contains the editor, graph, charts, illustrations, and modal. `src/lib/` contains storage, analysis, prompts, demo data, and the media capture hook. Fonts, illustrations, and model assets are self-hosted. `scripts/copy-models.mjs` runs before development and production builds.

`vercel.json` configures static deployment of `dist/`. Generated output, local Vercel project metadata, and environment files are excluded from Git.
