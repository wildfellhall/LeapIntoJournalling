# Local text emotion classifier

Leap uses a small **custom linear classifier with explicit-feeling rules**, not Google's BERT model or the RoBERTa GoEmotions model. It runs synchronously in the browser, requires no runtime packages beyond the app, and never sends entry text to a service. Static Vercel builds bundle the existing JSON. Training is not part of `npm install`, `npm run build`, or deployment.

## Model and data

- Model: seven independent logistic regressions over 12,000 TF-IDF word/bigram features, L2 regularization, sublinear term frequency, normalized document vectors, coefficients quantized to multiples of 1/256.
- Dataset: [Google Research GoEmotions](https://github.com/google-research/google-research/tree/master/goemotions), Apache 2.0, pinned revision `2adf640a14f11025ae5a9d0ec493b78530d276d3`. Attribution and license ship in `public/licenses/emotions/`.
- Training: 43,410 comments. Validation: 5,426 comments. Held-out test: 5,427 comments. Vocabulary and coefficients use training data only. Thresholds use validation data only, maximizing F0.5 subject to at least 70% validation precision for each label. No journal entries are used in training.
- Label mapping: Google's supplied `ekman_mapping.json`, plus neutral. Joy includes love, gratitude, relief and other positive categories; sadness includes grief and disappointment; anger includes annoyance and disapproval; fear includes nervousness; surprise includes curiosity, confusion and realization. Disgust is its own category. These are broad text categories, not a complete emotional vocabulary.
- Weight artifact: `src/lib/emotion-model.json`, about 597 KB raw / 221 KB gzip. The training data is about 4.4 MB and is not shipped to users or checked into this repository.

## Inference and display

`src/lib/emotions.ts` matches training feature extraction and scoring; parity fixtures compare the Python and JavaScript implementations. Sentence and contrast boundaries split longer writing into segments, with an 80-word maximum and no truncation of the entry. Common negations mask the following three tokens rather than inventing an opposite emotion. Explicit first-person statements (such as "I am angry" or "I feel happy and sad") also receive labels from a small curated cue list after negation masking. This handles clear statements that the learned thresholds would otherwise miss; arbitrary keyword mentions do not trigger these rules. For learned predictions, at least 25% of substantive tokens must be recognized; predictions must pass the learned threshold and contain a positive substantive feature contribution of at least 0.75 logit units.

Accepted label scores are weighted by the number of supporting words and normalized into an entry profile. Multiple labels are retained. `segments-2` adds original-text offsets, subject and temporal tags, plus conservative exclusions for quotes, hypothetical language, explicit sarcasm cues and descriptions of others. These are heuristics, not general language understanding. Coverage is the share of input words supporting accepted labels. Strength averages accepted model scores or explicit-feeling rule scores; reliability is strength × √coverage. These separate evidence measures lower the influence of sparse labels on graph connections. Explicit rules can produce strength 1 without implying certainty about the writer.

The profile's weights are relative model evidence, **not calibrated probabilities of feelings**. Neutral and uncertain results have an empty profile; empty text is separately marked `no-text`. Neutral does not mean calm. VADER remains solely responsible for the separate tone score.

Insights counts entries with each accepted label and calculates their average word counts. A mixed entry can appear in multiple categories. Check-in charts remain self-reports. Graphs compare full emotion profiles using cosine similarity, keeping facial estimates and check-ins as separate contributions. Old entries are reanalyzed in memory on load; backups are reanalyzed on import and then persisted. Original content and mood choices are retained. User-reviewed emotion labels (including an empty set) override automatic profiles for downstream views and survive upgrades and imports. Corrections remain local and do not silently retrain the shared model.

## Evaluation and limits

Full results, thresholds, data hashes, and artifact sizes are in [emotion-evaluation.json](emotion-evaluation.json). The quantized single-segment classifier has test micro-F1 **0.4737** and macro-F1 **0.3783** across the seven training labels at the chosen conservative thresholds. Per-label precision ranges from about 67% to 91%; recall is low, particularly for anger and surprise. These are **Reddit test-set results, not journal accuracy**. They do not evaluate the app's extra explicit-feeling, segmentation, evidence, or negation rules; those have separate regression tests.

The model favors abstention and will miss subtle feelings. English Reddit comments differ from personal journals, and their demographic and annotation biases remain. Unmarked sarcasm, implicit/named-person attribution, multilingual writing, complex negation, long narratives, and transcription errors can still mislead it. It does not diagnose conditions, infer causes, or determine how someone really felt. User-entered moods are never rewritten by the classifier. A larger contextual model would need a separate size/accuracy decision and journal-specific evaluation.

## Reproduce

Requires Python with NumPy and SciPy (development used NumPy 2.4.2 and SciPy 1.17.1). No Python dependency is needed for deployment.

```sh
mkdir -p /tmp/leap-emotion-training
for name in train.tsv dev.tsv test.tsv emotions.txt ekman_mapping.json; do
  curl --fail --location "https://raw.githubusercontent.com/google-research/google-research/2adf640a14f11025ae5a9d0ec493b78530d276d3/goemotions/data/$name" -o "/tmp/leap-emotion-training/$name"
done
OPENBLAS_NUM_THREADS=1 python3 scripts/train-emotions.py --data /tmp/leap-emotion-training --output /tmp/leap-text-baseline
npm test
npm run build
```

Compare the downloaded files' SHA-256 hashes with the checked-in evaluation manifest before training. Training writes JSON weights, evaluation and parity fixtures to the chosen output directory, without modifying the shipped artifact; the held-out test set is only evaluated after coefficients and thresholds are fixed.

Citation: Demszky, D. et al. (2020), *GoEmotions: A Dataset of Fine-Grained Emotions*, ACL. [Paper](https://aclanthology.org/2020.acl-main.372/).

## Journal-style candidate and full-pipeline scenarios

An opt-in `--journal-augment` experiment adds 28 original synthetic journal-style examples (weight 4) to training and 14 separate development examples for threshold selection. It scored test micro-F1 0.4665 / macro-F1 0.3749, below the deployed baseline. It was **not promoted**. These authored examples are not private journals or human-validated journal data. See [candidate results](text-candidate-evaluation.json).

`node scripts/evaluate-emotions.mjs` evaluates the browser pipeline against 36 authored scenarios, including subject attribution, past/present changes, mixed feelings, negation and deliberately difficult indirect language. Results, including all failures, are saved in [journal-evaluation.json](journal-evaluation.json). These regression cases are known during development and are not an unbiased journal-accuracy estimate. No thresholds are fitted to this scenario set.
