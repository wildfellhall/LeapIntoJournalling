import { describe, expect, it } from "vitest";
import { analyze, ANALYSIS_VERSION, similarity, upgradeAnalysis } from "./analysis";
import { classifyEmotions, rawEmotionScores } from "./emotions";
import parity from "../../scripts/emotion-parity.json";
import { defaultDecoration, type Entry } from "./types";

const entry = (id: string, text: string): Entry => ({
  id, title: "Reflection", text, date: "2026-10-10", createdAt: "2026-10-10T12:00:00Z",
  mode: "writing", mood: null, expressions: [], decoration: defaultDecoration, analysis: analyze(text),
});

describe("compact local emotion classifier", () => {
  it("matches the Python training implementation after weight quantization", () => {
    for (const example of parity) rawEmotionScores(example.text).forEach((score, i) =>
      expect(score, example.text).toBeCloseTo(example.scores[i], 10),
    );
  });

  it.each([
    ["I feel happy and grateful.", "joy"],
    ["I am sad and lonely.", "sadness"],
    ["I am angry and frustrated.", "anger"],
    ["I am afraid and nervous.", "fear"],
    ["That is disgusting and gross.", "disgust"],
    ["Wow, what a surprise!", "surprise"],
  ])("classifies %s as %s", (text, label) => {
    const result = classifyEmotions(text);
    expect(result.emotionStatus).toBe("classified");
    expect(Object.keys(result.emotions)).toContain(label);
  });

  it("retains mixed emotions across sentences and contrast", () => {
    for (const text of [
      "I feel happy and grateful. I am sad and lonely.",
      "I feel happy and grateful but I am sad and lonely.",
    ]) {
      expect(classifyEmotions(text).emotions.joy).toBeGreaterThan(0);
      expect(classifyEmotions(text).emotions.sadness).toBeGreaterThan(0);
    }
  });

  it("recognizes explicit feelings and conjunctions even when the training word is rare", () => {
    for (const [text, label] of [
      ["I am devastated.", "sadness"], ["I am ecstatic.", "joy"],
      ["I am furious.", "anger"], ["I am angry.", "anger"],
      ["I'm joyful.", "joy"], ["I've been feeling nervous.", "fear"],
    ]) expect(Object.keys(classifyEmotions(text).emotions), text).toContain(label);
    expect(classifyEmotions("I am happy and sad.").emotions).toEqual({ joy: 0.5, sadness: 0.5 });
    expect(classifyEmotions("I am happy and not sad.").emotions).toEqual({ joy: 1 });
    expect(classifyEmotions("I am not happy and sad.").emotions).toEqual({});
  });

  it("abstains on missing, unsupported, factual and negated emotional evidence", () => {
    expect(classifyEmotions("").emotionStatus).toBe("no-text");
    for (const text of ["123", "你好", "🌼", "constructor __proto__ prototype", "I filed the document.", "The meeting is at three."])
      expect(classifyEmotions(text).emotions, text).toEqual({});
    for (const text of ["I don’t feel happy.", "I am NOT happy.", "I am not sad.", "I am no longer angry."])
      expect(classifyEmotions(text).emotions, text).toEqual({});
    expect(classifyEmotions("I am not sad. I feel happy and grateful.").emotions).toEqual({ joy: 1 });
    expect(classifyEmotions("table ".repeat(79) + "not happy.").emotions.joy).toBeUndefined();
  });

  it("processes the end of long transcripts and produces finite normalized profiles", () => {
    const text = "A factual record of the schedule. ".repeat(300) + "I am sad and lonely.";
    expect(classifyEmotions(text).emotions.sadness).toBeGreaterThan(0);
    const profile = classifyEmotions("I feel happy and grateful. I am sad and lonely.").emotions;
    expect(Object.values(profile).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Object.values(profile).every(Number.isFinite)).toBe(true);
  });

  it("upgrades polarity-only entries while preserving original text, mood and media", () => {
    const saved = { ...entry("old", "I am sad and lonely."), mood: "joyful" as const,
      recording: new Blob(["audio"]), analysis: { ...analyze(""), method: "local-vader" as const,
        version: "vader-1.1.3/sentences-1", emotions: { positive: 0, negative: 1, neutral: 0 } } };
    const original = saved.analysis;
    const upgraded = upgradeAnalysis(saved);
    expect(upgraded.emotions.sadness).toBeGreaterThan(0);
    expect(upgraded.emotions.negative).toBeUndefined();
    expect(upgraded.version).toBe(ANALYSIS_VERSION);
    expect(saved.analysis).toBe(original);
    expect(saved.mood).toBe("joyful");
    expect(saved.recording.size).toBe(5);
  });
});

describe("emotion-aware entry relationships", () => {
  it("distinguishes sadness from anger at the same negative sentiment score", () => {
    const sad = entry("sad", "Garden flowers. I am sad and lonely.");
    const alsoSad = entry("sad2", "Garden flowers. I am sad and lonely.");
    const angry = entry("angry", "Garden flowers. I am angry and frustrated.");
    for (const e of [sad, alsoSad, angry]) e.analysis.score = -0.7;
    const corpus = [sad, alsoSad, angry];
    expect(similarity(sad, alsoSad, corpus).textEmotion).toBe(1);
    expect(similarity(sad, angry, corpus).textEmotion).toBe(0);
    expect(similarity(sad, angry, corpus).sharedEmotions).toEqual([]);
    expect(similarity(sad, alsoSad, corpus).score).toBeGreaterThan(similarity(sad, angry, corpus).score);
  });

  it("does not count absent or uncertain emotion as a match", () => {
    const a = entry("a", "");
    const b = entry("b", "");
    expect(similarity(a, b, [a, b]).emotion).toBeNull();
    const c = { ...a, title: "", mood: "low" as const };
    const d = { ...b, title: "", mood: "joyful" as const };
    expect(similarity(c, d, [c, d]).mood).toBeCloseTo(0.225);
    expect(similarity(c, d, [c, d]).textEmotion).toBeNull();
  });
});
