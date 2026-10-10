import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { analyze, similarity } from "./analysis";
import { classifyEmotions } from "./emotions";
import { entryEmotions, signalWindows, comparableFace, transcriptAligned } from "./signals";
import { acousticSample, faceQuality, smoothExpressions } from "./mediaSignals";
import { defaultDecoration, type Entry } from "./types";
import { getEntries, importEntries } from "./storage";
import { summarizeInsights } from "./insights";

const entry = (id = "signal-test", text = "I feel happy."): Entry => ({ id, title: id, text, date: "2026-10-10", createdAt: "2026-10-10T12:00:00Z", mode: "voice", mood: null, analysis: analyze(text), expressions: [], decoration: defaultDecoration,
  duration: 10, transcript: { text, passages: [{ id: "passage", text, start: 1, end: 5, timing: "approximate" }] } });

describe("context and evidence", () => {
  it.each(["She is sad.", "My friend is terrified.", 'My friend said, "I am happy."', "If I were happy I would leave.", "Yeah right, I am so happy."])("excludes %s from the writer's labels", (text) => {
    const result = classifyEmotions(text);
    expect(result.emotions).toEqual({});
    expect(result.evidence.reliability).toBe(0);
    expect(result.evidence.segments.some((segment) => segment.excluded)).toBe(true);
  });
  it("preserves historical and current labels with exact offsets", () => {
    const text = "Yesterday I felt sad but I am happy now.";
    const result = classifyEmotions(text);
    expect(Object.keys(result.emotions).sort()).toEqual(["joy", "sadness"]);
    expect(result.evidence.segments.map((s) => s.time)).toEqual(["past", "present"]);
    for (const segment of result.evidence.segments) expect(text.slice(segment.start, segment.end)).toBe(segment.text);
  });
  it("keeps proportion separate from strength and lowers sparse evidence weight", () => {
    const brief = entry("brief", "I feel sad.");
    const sparse = entry("sparse", "I filed the report. ".repeat(60) + "I feel sad.");
    expect(brief.analysis.emotions).toEqual(sparse.analysis.emotions);
    expect(sparse.analysis.evidence!.coverage).toBeLessThan(0.01);
    expect(sparse.analysis.evidence!.reliability).toBeLessThan(brief.analysis.evidence!.reliability);
    const target = entry("target", "I am devastated.");
    expect(similarity(sparse, target, [sparse, target]).score).toBeLessThan(similarity(brief, target, [brief, target]).score);
  });
});

describe("user review and time alignment", () => {
  it("honors multiple labels and explicitly confirmed none, including entries without text", () => {
    const corrected = { ...entry(), emotionCorrection: { labels: ["anger", "fear"] as const, updatedAt: "2026-10-10T12:00:00Z" } };
    const mixed = { ...corrected, emotionCorrection: { ...corrected.emotionCorrection, labels: [...corrected.emotionCorrection.labels] } };
    expect(entryEmotions(mixed)).toEqual({ anger: .5, fear: .5 });
    const none = { ...mixed, emotionCorrection: { ...mixed.emotionCorrection, labels: [] } };
    expect(entryEmotions(none)).toEqual({});
    const noText = { ...mixed, text: "", analysis: analyze("") };
    const summary = summarizeInsights([noText, none], "all");
    expect(summary.emotionEntries).toBe(1);
    expect(summary.correctedEntries).toBe(2);
    expect(summary.emotionDistribution.find((e) => e.id === "joy")!.count).toBe(0);
    expect(summary.emotionTimeline[0].anger).toBe(1);
  });
  it("only compares overlapping, usable expressions and preserves disagreements", () => {
    const good: Entry = { ...entry(), expressions: [{ at: 2, quality: .9, scores: { happy: .9, sad: .1 } }, { at: 9, quality: 1, scores: { angry: 1 } }] };
    expect(comparableFace(good).quality).toBeGreaterThan(0);
    expect(signalWindows(good)[0].faces.anger).toBeUndefined();
    const conflict = { ...good, expressions: [{ at: 2, quality: .9, scores: { sad: 1 } }] };
    expect(signalWindows(conflict)[0].disagreement).toBe(true);
    expect(comparableFace(conflict).quality).toBe(0);
    expect(comparableFace({ ...good, mood: "low" }).quality).toBe(0);
    expect(comparableFace({ ...good, emotionCorrection: { labels: ["sadness"], updatedAt: "2026-10-10" } }).quality).toBe(0);
    expect(comparableFace({ ...good, expressions: [{ at: 2, scores: { happy: 1 } }] }).quality).toBe(0);
  });
  it("does not align edited or partial transcripts to old timestamps", () => {
    expect(transcriptAligned(entry())).toBe(true);
    const edited = { ...entry(), text: "I feel sad." };
    expect(signalWindows(edited)).toEqual([]);
    const prefixed = { ...entry(), transcript: { ...entry().transcript!, text: "A note. I feel happy." } };
    expect(transcriptAligned(prefixed)).toBe(false);
  });
  it("round-trips reviewed metadata and rejects malformed imports atomically", async () => {
    const original = { ...entry("reviewed-backup"), emotionCorrection: { labels: ["fear"], updatedAt: "2026-10-10T12:00:00Z" }, acoustics: [acousticSample(new Float32Array(2048), 48000, 2)] };
    const backup = (entries: unknown[]) => new File([JSON.stringify({ format: "leap-journal", version: 3, entries })], "reviewed.json");
    await importEntries(backup([original]));
    const saved = (await getEntries()).find((e) => e.id === original.id)!;
    expect(saved.emotionCorrection).toEqual(original.emotionCorrection);
    expect(saved.transcript).toEqual(original.transcript);
    expect(saved.acoustics).toEqual(original.acoustics);
    for (const invalid of [
      { emotionCorrection: { labels: ["made-up"], updatedAt: original.createdAt } },
      { emotionCorrection: { labels: ["joy", "joy"], updatedAt: original.createdAt } },
      { transcript: { text: "", passages: [{ id: "a", start: 5, end: 1, text: "", timing: "approximate" }] } },
      { acoustics: [{ ...original.acoustics[0], rms: 5 }] },
      { expressions: [{ at: 1, quality: -1, scores: { happy: 1 } }] },
    ]) await expect(importEntries(backup([entry("never-written"), { ...original, ...invalid }]))).rejects.toThrow();
    expect((await getEntries()).some((e) => e.id === "never-written")).toBe(false);
  });
});

describe("media measurements", () => {
  it("finds pitch independent of gain and abstains on silence and clipping", () => {
    const tone = (gain: number) => Float32Array.from({ length: 2048 }, (_, i) => gain * Math.sin(2 * Math.PI * 200 * i / 48000));
    const a = acousticSample(tone(.3), 48000, 1), b = acousticSample(tone(.04), 48000, 1);
    expect(a.pitchHz).toBeCloseTo(200, -1);
    expect(a.pitchHz).toBe(b.pitchHz);
    expect(acousticSample(new Float32Array(2048), 48000, 1).pitchHz).toBeNull();
    const clipped = tone(1.7).map((v) => Math.max(-1, Math.min(1, v)));
    expect(acousticSample(clipped, 48000, 1).quality).toBe(0);
  });
  it("rejects dark, blurred, clipped and badly angled face crops", () => {
    const geometry = { box: [100, 100, 100, 120], boxScore: .95, mesh: [[125, 140], [175, 140], [150, 160]] };
    const pixels = (light: number, texture = false) => Uint8ClampedArray.from({ length: 64 * 64 * 4 }, (_, i) => i % 4 === 3 ? 255 : light + (texture ? (Math.floor(i / 4) % 2 ? 25 : -25) : 0));
    const check = (data: Uint8ClampedArray, face = geometry) => faceQuality(data, 64, 64, face, 640, 480);
    expect(check(pixels(120, true)).quality).toBeGreaterThan(.5);
    expect(check(pixels(5)).quality).toBe(0);
    expect(check(pixels(120)).quality).toBe(0);
    expect(check(pixels(120, true), { ...geometry, box: [0, 100, 100, 120] }).quality).toBe(0);
    expect(check(pixels(120, true), { ...geometry, mesh: [[125, 140], [175, 190], [170, 160]] }).quality).toBe(0);
  });
  it("smooths nearby expression changes and resets after a gap", () => {
    const earlier = { at: 1, scores: { happy: 1 }, quality: .9 };
    const next = { at: 3, scores: { angry: 1 }, quality: .9 };
    expect(smoothExpressions(earlier, next).scores.angry).toBeGreaterThan(.5);
    expect(smoothExpressions(earlier, next).rawScores).toEqual(next.scores);
    expect(smoothExpressions(earlier, { ...next, at: 8 }).scores).toEqual(next.scores);
  });
});
