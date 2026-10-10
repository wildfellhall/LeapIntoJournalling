import { entryEmotions, emotionReliability, comparableFace } from "./signals";
import { moods, type Analysis, type Entry } from "./types";
import { assessSentiment, SENTIMENT_VERSION } from "./sentiment";
import { classifyEmotions, emotionLabels, EMOTION_VERSION } from "./emotions";

export const ANALYSIS_VERSION = `${SENTIMENT_VERSION}/${EMOTION_VERSION}`;

// Sentiment terms excluded from topic keywords; scoring uses VADER separately.
const sentimentTerms = new Set(
  "happy happiness joyful joy excited excitement wonderful love loved loving amazing grateful gratitude thankful proud peaceful peace calm content hope hopeful good great beautiful kind kindness safe connected connection laugh laughed laughter smile smiled enjoy enjoyed fun relieved relief relaxed supported support inspired optimistic better growth progress accomplished cozy rested sad sadness unhappy lonely alone hurt pain painful grief grieving depressed hopeless awful terrible hate hated angry anger furious anxious anxiety worried worry nervous fear afraid scared stressed stress overwhelmed exhausted tired frustrated frustration disappointed difficult hard failed failure guilt guilty shame upset cry cried".split(
    " ",
  ),
);
const stopwords = new Set(
  "a an the i me my mine myself we our ours you your yours he she it its they them their and or but so to of in on at by for from with is am are was were be been being have has had do does did can could will would should may might this that these those as if than then when while where why how not no never very just really more most much many some any all each every one two also about into out up down today yesterday tomorrow day days feel felt feeling feelings get got going went go thing things want wanted know think time like little still something don t s ve ll m re t".split(
    " ",
  ),
);
const tokenize = (text: string) =>
  text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
export function analyze(text: string): Analysis {
  const words = tokenize(text);
  const counts = new Map<string, number>();
  words
    .filter((w) => w.length > 2 && !stopwords.has(w) && !sentimentTerms.has(w))
    .forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
  return {
    ...assessSentiment(text),
    ...classifyEmotions(text),
    wordCount: text.trim() ? text.trim().split(/\s+/u).length : 0,
    keywords: [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([w]) => w),
    method: "local-vader-emotion",
    version: ANALYSIS_VERSION,
  };
}
export function upgradeAnalysis(entry: Entry): Analysis {
  return entry.analysis.method === "local-vader-emotion" &&
    entry.analysis.version === ANALYSIS_VERSION &&
    entry.analysis.emotionStatus !== undefined &&
    entry.analysis.emotions &&
    Object.entries(entry.analysis.emotions).every(([key, value]) =>
      ["joy", "sadness", "anger", "fear", "disgust", "surprise"].includes(key) &&
      Number.isFinite(value) && value > 0 && value <= 1)
    ? entry.analysis
    : analyze(entry.text);
}

export function analysisMethodLabel(analysis: Analysis) {
  return analysis.method === "local-vader-emotion"
    ? "On-device emotion classifier + VADER tone"
    : analysis.method === "local-vader"
    ? "VADER · on-device English analysis"
    : "Legacy word-list estimate";
}

export function entryScore(e: Entry) {
  return e.mood ? moods.find((m) => m.id === e.mood)!.value : e.analysis.score;
}
function cosine(a: Record<string, number>, b: Record<string, number>) {
  const dot = Object.keys(a).reduce((s, k) => s + a[k] * (b[k] || 0), 0);
  const norm = Math.sqrt(
    Object.values(a).reduce((s, n) => s + n * n, 0) *
      Object.values(b).reduce((s, n) => s + n * n, 0),
  );
  return norm ? dot / norm : 0;
}
export function similarity(a: Entry, b: Entry, corpus: Entry[]) {
  const documents = corpus.map(
    (e) =>
      new Set(
        tokenize(`${e.title} ${e.text}`).filter((w) => !stopwords.has(w)),
      ),
  );
  const vector = (entry: Entry) => {
    const counts: Record<string, number> = Object.create(null);
    tokenize(`${entry.title} ${entry.text}`)
      .filter((w) => w.length > 2 && !stopwords.has(w))
      .forEach((w) => (counts[w] = (counts[w] || 0) + 1));
    Object.keys(counts).forEach(
      (w) =>
        (counts[w] *=
          Math.log(
            1 + corpus.length / (1 + documents.filter((d) => d.has(w)).length),
          ) + 1),
    );
    return counts;
  };
  const content = cosine(vector(a), vector(b));
  const aEmotions = entryEmotions(a), bEmotions = entryEmotions(b);
  const textAvailable = emotionLabels(aEmotions).length > 0 && emotionLabels(bEmotions).length > 0;
  const textEmotion = textAvailable ? cosine(aEmotions, bEmotions) : null;
  const textQuality = Math.sqrt(emotionReliability(a) * emotionReliability(b));
  const mood = a.mood && b.mood ? 1 - Math.abs(entryScore(a) - entryScore(b)) / 2 : null;
  const emotion = textEmotion !== null && mood !== null ? (textEmotion * textQuality + mood) / (1 + textQuality) : textEmotion ?? mood;
  const aFace = comparableFace(a), bFace = comparableFace(b);
  const faceQuality = Math.sqrt(aFace.quality * bFace.quality);
  const faceAvailable = faceQuality > 0;
  const face = faceAvailable ? cosine(aFace.scores, bFace.scores) : 0;
  const faceWeight = 0.1 * faceQuality;
  const emotionWeight = (0.35 - faceWeight) * (mood !== null ? 1 : textQuality);
  const availableWeight = 0.65 + (emotion !== null ? emotionWeight : 0) + faceWeight;
  const score = (content * 0.65 + (emotion ?? 0) * emotionWeight + face * faceWeight) / availableWeight;
  const shared = a.analysis.keywords.filter((w) =>
    b.analysis.keywords.includes(w),
  );
  return {
    score: Math.max(0, Math.min(1, score)),
    content,
    emotion,
    textEmotion,
    mood,
    sharedEmotions: emotionLabels(aEmotions)
      .filter(({ id }) => (bEmotions[id] || 0) > 0)
      .map(({ label }) => label),
    face: faceAvailable ? face : null,
    shared,
  };
}
export function related(entry: Entry, entries: Entry[]) {
  return entries
    .filter((e) => e.id !== entry.id)
    .map((e) => ({ entry: e, ...similarity(entry, e, entries) }))
    .sort((a, b) => b.score - a.score);
}
