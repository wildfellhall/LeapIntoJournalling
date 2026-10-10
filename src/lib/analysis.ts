import { moods, type Analysis, type Entry } from "./types";

const lexicon: Record<string, number> = {
  happy: 3,
  happiness: 3,
  joyful: 3,
  joy: 3,
  excited: 3,
  excitement: 3,
  wonderful: 3,
  love: 3,
  loved: 3,
  loving: 3,
  amazing: 3,
  grateful: 3,
  gratitude: 3,
  thankful: 3,
  proud: 2,
  peaceful: 2,
  peace: 2,
  calm: 2,
  content: 2,
  hope: 2,
  hopeful: 2,
  good: 2,
  great: 3,
  beautiful: 2,
  kind: 2,
  kindness: 2,
  safe: 2,
  connected: 2,
  connection: 1,
  laugh: 2,
  laughed: 2,
  laughter: 2,
  smile: 2,
  smiled: 2,
  enjoy: 2,
  enjoyed: 2,
  fun: 2,
  relieved: 2,
  relief: 2,
  relaxed: 2,
  supported: 2,
  support: 1,
  inspired: 2,
  optimistic: 2,
  better: 1,
  growth: 1,
  progress: 2,
  accomplished: 2,
  cozy: 1,
  rested: 1,
  sad: -2,
  sadness: -2,
  unhappy: -2,
  lonely: -2,
  alone: -1,
  hurt: -2,
  pain: -2,
  painful: -2,
  grief: -3,
  grieving: -3,
  depressed: -3,
  hopeless: -3,
  awful: -3,
  terrible: -3,
  hate: -3,
  hated: -3,
  angry: -3,
  anger: -3,
  furious: -3,
  anxious: -2,
  anxiety: -2,
  worried: -2,
  worry: -2,
  nervous: -2,
  fear: -2,
  afraid: -2,
  scared: -2,
  stressed: -2,
  stress: -2,
  overwhelmed: -3,
  exhausted: -2,
  tired: -1,
  frustrated: -2,
  frustration: -2,
  disappointed: -2,
  difficult: -1,
  hard: -1,
  failed: -2,
  failure: -2,
  guilt: -2,
  guilty: -2,
  shame: -2,
  upset: -2,
  cry: -2,
  cried: -2,
};
const stopwords = new Set(
  "a an the i me my mine myself we our ours you your yours he she it its they them their and or but so to of in on at by for from with is am are was were be been being have has had do does did can could will would should may might this that these those as if than then when while where why how not no never very just really more most much many some any all each every one two also about into out up down today yesterday tomorrow day days feel felt feeling feelings get got going went go thing things want wanted know think time like little still something don t s ve ll m re t".split(
    " ",
  ),
);
const tokenize = (text: string) =>
  text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
export function analyze(text: string): Analysis {
  const words = tokenize(text);
  let total = 0,
    matches = 0;
  const emotions: Record<string, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  for (let i = 0; i < words.length; i++) {
    let score = Object.hasOwn(lexicon, words[i]) ? lexicon[words[i]] : 0;
    if (!score) continue;
    const previous = words.slice(Math.max(0, i - 3), i);
    if (
      previous.some((w) =>
        [
          "not",
          "never",
          "no",
          "don't",
          "didn't",
          "wasn't",
          "isn't",
          "can't",
        ].includes(w),
      )
    )
      score *= -0.7;
    total += score;
    matches++;
    emotions[score > 0 ? "positive" : "negative"] += Math.abs(score);
  }
  const counts = new Map<string, number>();
  words
    .filter(
      (w) => w.length > 2 && !stopwords.has(w) && !Object.hasOwn(lexicon, w),
    )
    .forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
  emotions.neutral = Math.max(1, words.length - matches);
  const sum = Object.values(emotions).reduce((a, b) => a + b, 0);
  Object.keys(emotions).forEach((k) => (emotions[k] /= sum));
  return {
    score: matches ? Math.tanh(total / Math.max(4, matches * 2)) : 0,
    wordCount: text.trim() ? text.trim().split(/\s+/u).length : 0,
    keywords: [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([w]) => w),
    emotions,
    method: "local-lexicon",
  };
}
export function entryScore(e: Entry) {
  return e.mood ? moods.find((m) => m.id === e.mood)!.value : e.analysis.score;
}
function expressionVector(e: Entry) {
  const v: Record<string, number> = Object.create(null);
  e.expressions.forEach((sample) =>
    Object.entries(sample.scores).forEach(
      ([k, n]) => (v[k] = (v[k] || 0) + n / e.expressions.length),
    ),
  );
  return v;
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
  const emotion = 1 - Math.abs(entryScore(a) - entryScore(b)) / 2;
  const faceAvailable = a.expressions.length > 0 && b.expressions.length > 0;
  const face = faceAvailable
    ? cosine(expressionVector(a), expressionVector(b))
    : 0;
  const score =
    content * 0.65 + emotion * (faceAvailable ? 0.25 : 0.35) + face * 0.1;
  const shared = a.analysis.keywords.filter((w) =>
    b.analysis.keywords.includes(w),
  );
  return {
    score: Math.max(0, Math.min(1, score)),
    content,
    emotion,
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
