# Connections, UI and deployment audit · October 10, 2026

The app was reviewed locally using fictional entries and isolated Chrome profiles. No personal journal, microphone, camera, or cloud transcription service was used. Recording tests use synthetic devices.

## Connection changes

- Every edge requires shared content in writing or a transcript. Matching check-ins, emotion labels, or titles cannot create an edge alone.
- Words and normalized phrases have separate TF–IDF vectors. Common English variants and a small synonym vocabulary connect terms such as boss/manager and office/work. Unique phrases no longer overwhelm word overlap in longer entries.
- Common filler, emotion words, and exact copies of an entry's selected prompt are excluded from topic evidence. Titles add context at a lower weight.
- Content accounts for at least 80% of ranking weight. Reliable text emotions, check-ins and aligned expression estimates contribute at most 12%, 5% and 3%, respectively. Unused signal weight returns to content, preserving these caps even when signals are absent.
- Graph lines are filtered by content evidence rather than drawn to every entry. Up to eight matches appear with numbered nodes and readable explanations; secondary links are limited to two per surrounding node.
- Recurring topics require at least three entries across three distinct days. Similar groups are deduplicated, and each expandable group links to its supporting entries.
- Corpus features, expression summaries and pair comparisons are reused rather than recalculated for every rendered edge. No new runtime dependency or model weights were added.

These are inspectable text patterns, not proven causes or psychological conclusions. The vocabulary is English and limited; word sense, negation and unrecognized synonyms can produce missed or misleading matches. Emotion and facial-model accuracy limitations still apply.

## UI review

Reviewed the home screen, writing editor and sticker tray, voice/video editors, journal library, entry detail, Connections, Insights, settings, help, and PDF report dialog at widths of 320, 390, 768 and 1440 pixels. Recording, review, storage, permission-denial and export flows are also covered by browser checks.

| Finding | Resolution |
| --- | --- |
| Weak or mood-only links and dense graph text | Require content evidence, limit visible links, number nodes, show supporting topics in a readable list |
| Mobile graph cropped peripheral nodes | Remove the old oversized SVG rule; verify node bounds at 320, 390 and 768 pixels |
| Home mood card overflowed on 320px screens | Allow grid items to shrink; wrap check-ins into three columns on small phones |
| Decorative art overlapped small-phone copy | Hide home illustration and format doodles below 361px |
| Long method explanations crowded Connections and Insights | Move secondary explanations into expandable details |
| Transcription controls were buried under Camera analysis | Group spoken-entry controls under Recording options; shorten supporting copy |
| Speech-pack installation conflicted with no-download requirement | Remove installation code and UI entirely |
| Duplicate New entry actions | Keep the page action in the journal and hide the redundant header action while editing |
| Settings was dominated by analysis details | Keep storage/backup actions visible and make secondary analysis information expandable |
| Saved cards omitted estimated emotions without a check-in | Show text estimates or reviewed labels; manual moods retain priority |

The reviewed screens fit the tested viewports without horizontal page overflow. Dialogs retain their internal scroll behavior. The README's Connections, Insights, voice and video screenshots were refreshed.

## Transcription boundary

Automatic English transcription runs only when an on-device recognition service is already available. The app never calls the browser's speech-pack installer and never silently uses cloud recognition. Otherwise, users can type or paste a transcript while recording remains available. Universal automatic transcription without local language support would require a different, potentially cloud-based service; none was enabled.

This follows the browser's distinction between available local recognition and downloadable language support: [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API#on-device_speech_recognition).

## Validation

- 63 unit tests passed, including unrelated same-mood entries, synonym matching across journal modes, contrasting emotions, copied prompts, missing transcripts, multi-day recurrence, longer sample entries, empty journals, and the strict 5% check-in influence cap.
- All 24 browser checks passed against the compiled static site. Coverage includes writing, synthetic voice/video capture and playback, local facial-model loading, storage persistence, backups, emotion corrections, download-free transcription behavior, graph connections, stickers, mobile layout, and PDF export/recovery.
- PDF checks now import fixtures through the app's restore flow and recognize both development and production asset paths, so the full suite can run against either build.
- Desktop/mobile captures and explicit page/node bounds checks complement the automated tests. This is a Chrome audit, not a claim of exhaustive testing on every browser, device or assistive technology.

Run `npm test`, `npm run build`, and (with the local server running) `npx playwright test`. For the compiled site, run `npm run preview` and set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173` when running browser checks.

## Deployment readiness

- A fresh copy of the tracked and pending source files passed `npm ci --offline --no-audit --no-fund` using cached packages, then `npm run build` under Node 22. It did not reuse the working directory's dependencies, generated models, or build output. No new packages or model downloads were needed.
- The manifest and lockfile agree. `npm audit` reported zero known vulnerabilities across production and development dependencies at audit time.
- `vercel.json` selects Vite, `npm ci`, `npm run build`, and `dist`, with the SPA fallback matching [Vercel's Vite guidance](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas). Node 22 is pinned in both `.nvmrc` and `package.json` and is a [supported Vercel version](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- Both facial-model manifests resolve to locally copied weights in the build; entry-point assets and documentation links resolve. Static output is approximately 7.1 MiB; PDF and camera-analysis code remain loaded on demand. No API keys, backend service, or build-time training is required.
- Tracked and pending files contain no environment files or common private-key/token signatures. Generated assets and local environment files remain excluded from Git.

The audit found no blocking issue for deployment with the checked configuration. Validation used a local production preview, not a live Vercel deployment; remote project settings and the deployed URL still need verification after deployment. Browser-dependent transcription and on-device journal storage limitations remain documented in the README.
