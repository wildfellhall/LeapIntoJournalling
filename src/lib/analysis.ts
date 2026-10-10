import { entryEmotions, emotionReliability, comparableFace } from "./signals";
import { createContentIndex, sentimentTerms, stopwords } from "./content";
import { moods, type Analysis, type Entry } from "./types";
import { assessSentiment, SENTIMENT_VERSION } from "./sentiment";
import { classifyEmotions, emotionLabels, EMOTION_VERSION } from "./emotions";

export const ANALYSIS_VERSION = `${SENTIMENT_VERSION}/${EMOTION_VERSION}/topics-2`;

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
// Build text vectors and quality summaries once per corpus, not once per SVG edge.
export function createConnectionIndex(corpus: Entry[]) {
  const entries = [...new Map(corpus.map((entry) => [entry.id, entry])).values()];
  const contentIndex = createContentIndex(entries);
  const profiles = new Map(entries.map((entry) => [entry.id, {
    emotions: entryEmotions(entry), reliability: emotionReliability(entry), face: comparableFace(entry),
  }]));
  const cache = new Map<string, ReturnType<typeof comparePair>>();
  function comparePair(a: Entry, b: Entry) {
    const content = contentIndex.compare(a, b);
    const ap = profiles.get(a.id)!, bp = profiles.get(b.id)!;
    const textAvailable = emotionLabels(ap.emotions).length > 0 && emotionLabels(bp.emotions).length > 0;
    const textEmotion = textAvailable ? cosine(ap.emotions, bp.emotions) : null;
    const textQuality = Math.sqrt(ap.reliability * bp.reliability);
    const mood = a.mood && b.mood ? 1 - Math.abs(entryScore(a) - entryScore(b)) / 2 : null;
    const faceQuality = Math.sqrt(ap.face.quality * bp.face.quality);
    const face = faceQuality > 0 ? cosine(ap.face.scores, bp.face.scores) : null;
    // Content always contributes at least 80%; mood check-ins at most 5%.
    const textWeight = textEmotion === null ? 0 : 0.12 * textQuality;
    const moodWeight = mood === null ? 0 : 0.05;
    const faceWeight = face === null ? 0 : 0.03 * faceQuality;
    // Return unused signal weight to content so optional signals retain their caps.
    const contentWeight = 1 - textWeight - moodWeight - faceWeight;
    const score = content.eligible
      ? content.content * contentWeight + (textEmotion ?? 0) * textWeight + (mood ?? 0) * moodWeight + (face ?? 0) * faceWeight
      : 0;
    return {
      ...content, score: Math.max(0, Math.min(1, score)), textEmotion, mood, face,
      emotion: textEmotion ?? mood,
      sharedEmotions: emotionLabels(ap.emotions).filter(({ id }) => (bp.emotions[id] ?? 0) > 0).map(({ label }) => label),
    };
  }
  function compare(a: Entry, b: Entry) {
    const key = JSON.stringify([a.id, b.id].sort());
    if (!cache.has(key)) cache.set(key, comparePair(a, b));
    return cache.get(key)!;
  }
  function rank(entry: Entry) {
    return entries.filter((other) => other.id !== entry.id)
      .map((other) => ({ entry: other, ...compare(entry, other) }))
      .filter((result) => result.eligible)
      .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  }
  return { compare, rank, patterns: contentIndex.patterns() };
}
export function similarity(a: Entry, b: Entry, corpus: Entry[]) {
  return createConnectionIndex([...corpus, a, b]).compare(a, b);
}
export function related(entry: Entry, entries: Entry[]) {
  return createConnectionIndex([...entries, entry]).rank(entry);
}
