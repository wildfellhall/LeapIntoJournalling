import model from "./emotion-model.json";

export const EMOTION_VERSION = `${model.version}/segments-2`;
export const emotionDefinitions = [
  { id: "joy", label: "Joy", color: "#edd28f" },
  { id: "sadness", label: "Sadness", color: "#a8c9e1" },
  { id: "anger", label: "Anger", color: "#e7aaa0" },
  { id: "fear", label: "Fear", color: "#bfb0db" },
  { id: "disgust", label: "Disgust", color: "#acc8a1" },
  { id: "surprise", label: "Surprise", color: "#e8b9d4" },
] as const;
export type Emotion = (typeof emotionDefinitions)[number]["id"];
export type EmotionStatus = "classified" | "neutral" | "uncertain" | "no-text";
export type EmotionScores = Partial<Record<Emotion, number>>;
export interface EmotionSegment {
  text: string;
  start: number;
  end: number;
  subject: "self" | "other" | "unspecified";
  time: "past" | "present" | "anticipated";
  emotions: EmotionScores;
  strength: number;
  evidenceWords: number;
  excluded?: "other-person" | "quotation" | "hypothetical" | "sarcasm-cue";
}
export interface EmotionEvidence {
  coverage: number;
  strength: number;
  reliability: number;
  segments: EmotionSegment[];
}

const terms: Record<string, number[]> = model.terms;
const labels = model.labels as (Emotion | "neutral")[];
const filler = new Set("a an the i me my mine we our you your he she it its they them their and or but to of in on at by for from with is am are was were be been being have has had do does did can could will would should may might this that these those as if than then when while where why how not no never very just really more most much some any all each every also about into out up down today yesterday tomorrow feel felt feeling feels get got going went go im i'm don't cant can't didn't doesn't isn't wasn't".split(" "));
const negation = /^(?:not|no|never|without|hardly|barely|\w+n't)$/;
const tokenize = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'").match(/[a-z]+(?:'[a-z]+)?/g) || [];

// A conservative learned threshold can miss even "I am angry", especially for
// rarer words. Honor explicit feeling statements without applying these cues
// to arbitrary mentions, other people's feelings, or negated evidence.
const directCues = new Map<string, Emotion>();
for (const [label, words] of Object.entries({
  joy: "happy joyful joyous glad delighted elated ecstatic cheerful grateful thankful excited hopeful relieved content proud loved loving",
  sadness: "sad unhappy miserable devastated heartbroken sorrowful grieving depressed lonely despondent disappointed dejected hopeless tearful",
  anger: "angry furious enraged irritated annoyed frustrated resentful outraged livid irate mad",
  fear: "afraid scared terrified fearful anxious nervous worried frightened panicked panicky apprehensive uneasy",
  disgust: "disgusted repulsed revolted sickened nauseated",
  surprise: "surprised astonished amazed stunned shocked astounded startled",
})) for (const word of words.split(" ")) directCues.set(word, label as Emotion);
const feelingModifiers = new Set("so very really deeply extremely quite a little bit somewhat slightly still both and also now finally completely incredibly absolutely truly just pretty rather more less not only".split(" "));

function directFeelings(words: string[]): Emotion[] {
  const found = new Set<Emotion>();
  for (let i = 0; i < words.length; i++) {
    const start = words[i] === "i'm" ? i + 1
      : words[i] === "i" && ["am", "feel", "felt", "was"].includes(words[i + 1]) ? i + 2
      : words[i] === "i" && words[i + 1] === "have" && words[i + 2] === "been" && words[i + 3] === "feeling" ? i + 4
      : words[i] === "i've" && words[i + 1] === "been" && words[i + 2] === "feeling" ? i + 3 : -1;
    if (start < 0) continue;
    for (let j = start; j < Math.min(words.length, start + 12); j++) {
      const word = words[j];
      if (word === "feeling" || feelingModifiers.has(word) || word.startsWith("~")) continue;
      const label = directCues.get(word);
      if (!label) break;
      found.add(label);
    }
  }
  return [...found];
}

function features(words: string[]) {
  return [...words, ...words.slice(1).map((word, i) => `${words[i]} ${word}`)];
}

function infer(words: string[]) {
  const counts = new Map<string, number>();
  for (const term of features(words))
    if (Object.hasOwn(terms, term)) counts.set(term, (counts.get(term) || 0) + 1);
  const vector = [...counts].map(([term, count]) => ({
    term,
    value: (1 + Math.log(count)) * terms[term][0],
  }));
  const norm = Math.hypot(...vector.map(({ value }) => value)) || 1;
  const logits = model.bias.map((value) => value / model.scale);
  const evidence = logits.map(() => 0);
  for (const { term, value } of vector) {
    const substantive = term.split(" ").some((word) => !filler.has(word));
    for (let i = 0; i < logits.length; i++) {
      const contribution = (value / norm) * (terms[term][i + 1] / model.scale);
      logits[i] += contribution;
      if (substantive) evidence[i] = Math.max(evidence[i], contribution);
    }
  }
  return { scores: logits.map((value) => 1 / (1 + Math.exp(-value))), evidence };
}

// Exported for cross-language parity checks against the training implementation.
export function rawEmotionScores(text: string) {
  return infer(tokenize(text)).scores;
}

function maskNegation(words: string[]) {
  let until = -1;
  return words.map((word, i) => {
    if (negation.test(word) && words[i + 1] !== "only" &&
        !(word === "without" && (words[i + 1] === "doubt" || words[i + 2] === "doubt"))) {
      until = i + 3;
      return word;
    }
    // Abstain on negated evidence rather than inventing its opposite emotion.
    return i <= until ? `~${word}` : word;
  });
}

export function classifyEmotions(text: string): { emotions: EmotionScores; emotionStatus: EmotionStatus; evidence: EmotionEvidence } {
  const segments: EmotionSegment[] = [];
  const accumulated: EmotionScores = {};
  let neutral = false;
  let totalWords = 0, evidenceWords = 0, strengthTotal = 0, acceptedWords = 0;
  const quoted = [...text.matchAll(/[“"][^”"\n]*[”"]/gu)].map((match) => [match.index!, match.index! + match[0].length]);
  // Keep offsets for passage review; split changes of speaker as well as contrasts.
  const boundary = /[.!?;\n]+|\b(?:but|however|yet)\b|\b(?:and|because|while|although)(?=\s+(?:I|he|she|they|my\s+\w+)\b)/giu;
  let offset = 0;
  const spans: [number, number][] = [];
  for (const match of text.matchAll(boundary)) { spans.push([offset, match.index!]); offset = match.index! + match[0].length; }
  spans.push([offset, text.length]);
  for (const [from, to] of spans) {
    const sentence = text.slice(from, to);
    const tokens = [...sentence.toLowerCase().replace(/[‘’]/g, "'").matchAll(/[a-z]+(?:'[a-z]+)?/g)];
    const words = maskNegation(tokens.map((token) => token[0]));
    totalWords += words.length;
    const self = /\b(?:i|i'm|i've|me|myself)\b/i.test(sentence);
    const selfFeeling = directFeelings(words).length > 0 || /\b(?:i (?:cried|cry|smiled|smile|laughed|laugh|wept|miss|love|hate|resent|regret|worry)|made me|left me|upset me)\b/i.test(sentence);
    const other = !selfFeeling && /\b(?:he|she|they|him|her|them|his|their|my (?:friend|partner|mother|father|mom|dad|sister|brother|child|boss|colleague))\b/i.test(sentence);
    const subject = other ? "other" : self ? "self" : "unspecified";
    const time = /\b(?:i (?:am|feel)|i'm)\b/i.test(sentence) ? "present" : /\b(?:tomorrow|will|would|might|could|next week)\b/i.test(sentence) ? "anticipated"
      : /\b(?:yesterday|last (?:night|week|month|year)|used to|felt|was|were)\b/i.test(sentence) ? "past" : "present";
    const excluded: EmotionSegment["excluded"] = /\b(?:yeah right|as if|sarcasm|sarcastic)\b|\/s\b/i.test(sentence) ? "sarcasm-cue"
      : /\b(?:if|wish|pretend|imagining)\b/i.test(sentence) || (!selfFeeling && /\b(?:would|might|could)\b/i.test(sentence)) ? "hypothetical"
      : other ? "other-person" : undefined;
    for (let start = 0; start < words.length; start += 80) {
      const chunk = words.slice(start, start + 80);
      const first = from + tokens[start].index!, last = tokens[Math.min(tokens.length - 1, start + 79)];
      const end = from + last.index! + last[0].length;
      const segment: EmotionSegment = { text: text.slice(first, end), start: first, end, subject, time, emotions: {}, strength: 0, evidenceWords: 0,
        excluded: quoted.some(([a, b]) => a < end && b > first) ? "quotation" : excluded };
      segments.push(segment);
      if (segment.excluded) continue;
      const explicit = directFeelings(chunk);
      const substantive = chunk.filter((word) => !filler.has(word));
      const known = substantive.filter((word) => Object.hasOwn(terms, word));
      if (!explicit.length && (!known.length || known.length / substantive.length < 0.25)) continue;
      const { scores, evidence } = infer(chunk);
      const accepted: EmotionScores = Object.fromEntries(explicit.map((label) => [label, 1]));
      for (let i = 0; i < labels.length; i++) {
        if (scores[i] < model.thresholds[i]) continue;
        const label = labels[i];
        if (label === "neutral") neutral = true;
        else if (evidence[i] >= 0.75 && !accepted[label]) accepted[label] = scores[i];
      }
      const values = Object.values(accepted);
      if (!values.length) continue;
      // Count the words that support a label, not every word in its sentence.
      const support = chunk.filter((word) => {
        if (directCues.has(word) && accepted[directCues.get(word)!]) return true;
        const term = Object.hasOwn(terms, word) ? terms[word] : undefined;
        return term && !filler.has(word) && labels.some((label, i) => label !== "neutral" && accepted[label] && term[i + 1] / model.scale > 1);
      }).length;
      segment.emotions = accepted;
      segment.strength = values.reduce((sum, value) => sum + value, 0) / values.length;
      segment.evidenceWords = Math.max(1, support);
      evidenceWords += segment.evidenceWords;
      strengthTotal += segment.strength * segment.evidenceWords;
      acceptedWords += segment.evidenceWords;
      for (const [label, value] of Object.entries(accepted))
        accumulated[label as Emotion] = (accumulated[label as Emotion] || 0) + value * segment.evidenceWords;
    }
  }
  const coverage = totalWords ? Math.min(1, evidenceWords / totalWords) : 0;
  const strength = acceptedWords ? strengthTotal / acceptedWords : 0;
  // A ranking weight, NOT a calibrated probability that someone feels an emotion.
  const evidence = { coverage, strength, reliability: strength * Math.sqrt(coverage), segments };
  const total = Object.values(accumulated).reduce((sum, value) => sum + value, 0);
  if (total) {
    for (const key of Object.keys(accumulated) as Emotion[]) accumulated[key]! /= total;
    return { emotions: accumulated, emotionStatus: "classified", evidence };
  }
  return { emotions: {}, emotionStatus: !text.trim() ? "no-text" : neutral ? "neutral" : "uncertain", evidence };
}

export function emotionLabels(scores: Record<string, number>) {
  return emotionDefinitions
    .filter(({ id }) => Number.isFinite(scores[id]) && scores[id] > 0)
    .sort((a, b) => scores[b.id] - scores[a.id]);
}

export function emotionDescription(analysis: { emotions: Record<string, number>; emotionStatus?: EmotionStatus }) {
  const labels = emotionLabels(analysis.emotions);
  return labels.length ? labels.map(({ label }) => label).join(", ")
    : analysis.emotionStatus === "no-text" ? "No text or transcript"
    : analysis.emotionStatus === "neutral" ? "No specific emotion detected"
    : "No clear emotion detected";
}
