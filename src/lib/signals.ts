import { classifyEmotions, emotionDescription, emotionLabels, type EmotionScores } from "./emotions";
import type { Entry, TranscriptPassage } from "./types";

export function entryEmotions(entry: Entry): EmotionScores {
  if (entry.emotionCorrection) return Object.fromEntries(entry.emotionCorrection.labels.map((id) => [id, 1 / (entry.emotionCorrection!.labels.length || 1)]));
  return entry.analysis.emotions;
}
export function entryEmotionDescription(entry: Entry) {
  if (entry.emotionCorrection && !entry.emotionCorrection.labels.length) return "No specific emotion · confirmed by you";
  return emotionDescription({ ...entry.analysis, emotions: entryEmotions(entry) });
}
export function emotionReliability(entry: Entry) {
  return entry.emotionCorrection ? 1 : entry.analysis.evidence?.reliability ?? 0;
}
export function joinPassages(passages: TranscriptPassage[]) { return passages.map((p) => p.text.trim()).filter(Boolean).join(" "); }
export function transcriptAligned(entry: Entry) {
  return !!entry.transcript?.passages.length && entry.text.trim() === entry.transcript.text.trim() &&
    entry.text.trim() === joinPassages(entry.transcript.passages);
}
const faceNames: Record<string, string> = { happy: "joy", sad: "sadness", angry: "anger", fearful: "fear", fear: "fear", disgust: "disgust", surprised: "surprise", surprise: "surprise" };
export function faceEmotions(scores: Record<string, number>): EmotionScores {
  return Object.fromEntries(Object.entries(scores).filter(([name]) => Object.hasOwn(faceNames, name)).map(([name, score]) => [faceNames[name], score]));
}

// Compare only overlapping intervals. The transcript is the entry text, not a
// second independent vote. Neither acoustics nor uncertain expression frames
// manufacture labels when the text is unlabeled.
export function signalWindows(entry: Entry) {
  if (!transcriptAligned(entry)) return [];
  return entry.transcript!.passages.map((passage) => {
    const analysis = classifyEmotions(passage.text);
    const samples = entry.expressions.filter((s) => s.at >= passage.start && s.at <= passage.end && (s.quality ?? 0) >= 0.5);
    const faces: Record<string, number> = {};
    let faceWeight = 0;
    for (const sample of samples) {
      faceWeight += sample.quality!;
      for (const [key, value] of Object.entries(faceEmotions(sample.scores))) faces[key] = (faces[key] || 0) + value * sample.quality!;
    }
    if (faceWeight) for (const key of Object.keys(faces)) faces[key] /= faceWeight;
    const topFace = emotionLabels(faces)[0]?.id;
    const disagreement = !!topFace && (faces[topFace] ?? 0) >= 0.4 && emotionLabels(analysis.emotions).length > 0 && !analysis.emotions[topFace];
    const acoustic = (entry.acoustics ?? []).filter((sample) => sample.at >= passage.start && sample.at <= passage.end);
    return { passage, analysis, faces, disagreement, faceQuality: samples.length ? faceWeight / samples.length : 0,
      acousticQuality: acoustic.length ? acoustic.reduce((sum, s) => sum + s.quality, 0) / acoustic.length : null };
  });
}
export function comparableFace(entry: Entry) {
  const scores: Record<string, number> = {};
  // Self-reports always take priority. Legacy frames lack quality metadata.
  if (entry.emotionCorrection || entry.mood) return { scores, quality: 0 };
  const windows = signalWindows(entry).filter((w) => !w.disagreement && w.analysis.evidence.reliability > 0 && w.faceQuality > 0 && Math.max(0, ...Object.values(w.faces)) >= 0.4);
  let weight = 0;
  for (const window of windows) {
    const q = window.faceQuality * window.analysis.evidence.reliability * Math.max(0, ...Object.values(window.faces));
    weight += q;
    for (const [key, value] of Object.entries(window.faces)) scores[key] = (scores[key] || 0) + value * q;
  }
  return { scores, quality: windows.length ? weight / windows.length : 0 };
}
