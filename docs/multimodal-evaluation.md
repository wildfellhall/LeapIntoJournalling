# Local prediction improvements and evaluation

The production app remains a static Vite/Vercel site. No new runtime package or larger model is shipped. Training scripts, public evaluation data and optional candidate weights are maintainer tools, never part of a deployment build. Tests use synthetic journal entries and synthetic recording devices, not personal journals or a real microphone/camera.

## What is enabled

- **Text:** passage offsets, subject/temporal heuristics, mixed labels, conservative abstention, and separate coverage/strength/reliability. See [model documentation](emotion-model.md). Relative emotion proportions are not confidence probabilities.
- **Review:** multiple user labels or explicitly confirmed none. Original predictions remain available. Corrections override predictions in Insights, Connections and PDF exports, and survive version 3 backups; older backups still import. Editing a saved transcript recomputes its automatic analysis locally.
- **Speech:** opt-in native English recognition, requiring `processLocally = true` and local availability. A legacy implementation cannot become a cloud fallback. Pack installation requires a separate user click and can have browser-controlled download sizes. Passage times approximate recognition events, not word timestamps. Native API support and real recognition accuracy still require browser/device testing.
- **Acoustics:** 250 ms samples of RMS, autocorrelation pitch (70–450 Hz), periodicity, zero-crossing rate and clipping. Unvoiced/unclear frames are not classified as silence or an emotion. These are observations only; voices outside this pitch range can be missed.
- **Face:** confidence, crop size/framing, brightness, Laplacian sharpness and a six-landmark pose heuristic reject weak samples. This is not a validated occlusion detector. Accepted samples retain original scores and use a two-second exponential time constant, resetting after rejected frames or a gap over five seconds. Neither individual nor smoothed scores establish how a person feels.
- **Combination:** compare overlapping transcript/face intervals only. No independent transcript vote in addition to its saved text. Edited, untimed or partial transcripts do not produce timing comparisons. Expression disagreement remains visible and is excluded from ranking. User corrections/check-ins disable the facial contribution. The remaining facial weight is quality × text reliability × expression strength, capped at 10%; sparse text evidence also reduces the text-emotion contribution.

## Experiments and promotion decisions

| Experiment | Observed result | Decision |
| --- | --- | --- |
| Journal-style linear text candidate | Held-out GoEmotions macro-F1 0.3749 vs deployed 0.3783; micro-F1 0.4665 vs 0.4737 | Keep deployed weights; ship context/evidence improvements separately |
| 180-parameter voice classifier | Actor-disjoint test macro-F1 0.1922 / accuracy 0.2222; gain/noise stress macro-F1 0.0556 | Do not ship or use for emotion labels |
| Human default vs AffectNet MobileNet | Both loaded and produced outputs locally; about 31 ms warm median inference each on this machine | Keep default; latency alone does not establish accuracy |

Text augmentation used original synthetic examples, not actual diary data. The 36 authored full-pipeline scenarios are regression cases, not blind evaluation. Failures remain in [journal-evaluation.json](journal-evaluation.json), including implicit emotion, idioms and double negatives. The candidate's full results are in [text-candidate-evaluation.json](text-candidate-evaluation.json).

The voice pilot uses **108 public CREMA-D utterances / 18 actors / one sentence**, 8,363,596 downloaded audio bytes. Actors 1001–1012 train; 1013–1015 select regularization; 1016–1018 test. Twenty-nine gain-normalized MFCC/statistical features feed a six-class linear softmax model. The 18 test clips are far too few to validate general performance. Labels are acted expressions; surprise is absent. Added gain/noise is a stress test, not validation across real microphones. Candidate weights stay in the chosen temporary data directory and are not loaded by the app. [Results and file hashes](voice-pilot.json).

The face benchmark uses an **unlabeled screenshot already supplied with the Human package**. It measures loading and warm inference, not expression accuracy or fairness. The optional 6.6 MiB candidate stays in `/tmp`, and Playwright serves it only to localhost. It is not copied into `public/` or `dist/`. Raw timings, image/model hashes and scores are in [face-benchmark.json](face-benchmark.json). Upstream model usage restrictions must be reviewed before any later production inclusion.

Before promoting a new voice/face model, collect a consented evaluation set with independent speakers/subjects, natural journal passages, self-reports kept separate from expression annotations, multiple real devices and lighting/noise conditions. Select thresholds on development data; report held-out per-class precision/recall, abstention coverage and subgroup/device failures. Do not present synthetic scenarios or the above pilots as representative validation.

## Reproduce locally

Use Node 22. Text/voice experiments require NumPy and SciPy; they are not app dependencies.

```sh
# Full browser text pipeline; no server or network download required.
node scripts/evaluate-emotions.mjs

# Requires the pinned GoEmotions files described in emotion-model.md.
OPENBLAS_NUM_THREADS=1 python3 scripts/train-emotions.py \
  --data /tmp/leap-emotion-training --journal-augment \
  --output /tmp/leap-text-candidate

# Explicit public-data download: 12 MB total cap, 200 KB per WAV.
# Omit --download to rerun with the cached files.
OPENBLAS_NUM_THREADS=1 python3 scripts/voice-pilot.py \
  --data /tmp/leap-voice-pilot --download

npm test
npm run build
npx playwright test
```

For optional face comparison, start `npm run dev`, then supply a folder containing `affectnet-mobilenet.json` and `.bin` from [human-models revision bc66dc5](https://github.com/vladmandic/human-models/tree/bc66dc53bac03c96d35a7e6daaf717e72f3985f5/models):

```sh
node scripts/benchmark-face.mjs --candidate /tmp/leap-face-candidate
# Optional: --manifest /path/to/consented-images.json
# Manifest: [{"file":"face.jpg","label":"happy","subject":"subject-01","condition":"daylight"}]
```

The face runner currently records labeled observations if supplied; it does not turn that manifest into a validation claim or automatically promote a model.

Sources: [CREMA-D dataset and paper attribution](https://github.com/CheyneyComputerScience/CREMA-D), pinned revision `1658cd342dff90010aa843eaeebd53610a08b1dc`; [ODbL / DbCL license](https://github.com/CheyneyComputerScience/CREMA-D/blob/1658cd342dff90010aa843eaeebd53610a08b1dc/LICENSE.txt). Candidate models and credits: [Human model documentation](https://github.com/vladmandic/human/wiki/Models). Local speech contract: [MDN processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally), [on-device recognition setup](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API#on-device_speech_recognition).
