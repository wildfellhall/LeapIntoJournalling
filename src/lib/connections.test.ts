import { describe, expect, it } from "vitest";
import { analyze, createConnectionIndex, related, similarity } from "./analysis";
import { defaultDecoration, type Entry } from "./types";
import { demoEntries } from "./demo";

function entry(id: string, text: string, date = "2026-10-01"): Entry {
  return { id, title: id, text, date, createdAt: date + "T12:00:00Z", mode: "writing", mood: null, analysis: analyze(text), expressions: [], decoration: defaultDecoration };
}

describe("content-grounded connections", () => {
  it("finds recurring content in longer journal entries without requiring the same wording", () => {
    const entries = demoEntries().map((entry) => ({ ...entry, mood: null }));
    const matches = related(entries[0], entries);
    expect(matches.map(({ entry }) => entry.title)).toEqual(expect.arrayContaining(["Taking the scenic route", "Sunday, slowly"]));
    expect(matches.every((match) => match.shared.length > 0)).toBe(true);
    expect(createConnectionIndex(entries).patterns.map(({ term }) => term)).not.toContain("finally");
  });
  it("never connects unrelated entries based only on mood, emotion, or titles", () => {
    const a = { ...entry("a", "I planted roses in the garden. I am happy."), title: "My day", mood: "joyful" as const };
    const b = { ...entry("b", "I submitted a budget proposal at work. I am happy."), title: "My day", mood: "joyful" as const };
    const result = similarity(a, b, [a, b]);
    expect(result.mood).toBe(1);
    expect(result.textEmotion).toBe(1);
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
    expect(related(a, [a, b])).toEqual([]);
  });
  it("connects word variants and synonyms across modes without check-ins", () => {
    const a = entry("a", "My boss discussed deadlines at the office.");
    const b = { ...entry("b", "My manager reviewed a deadline at work."), mode: "voice" as const };
    const c = { ...entry("c", "A supervisor mentioned deadlines at my job."), mode: "video" as const };
    const index = createConnectionIndex([a, b, c]);
    expect(index.rank(a).map(({ entry }) => entry.id).sort()).toEqual(["b", "c"]);
    expect(index.compare(a, b).shared).toEqual(expect.arrayContaining(["work", "manager", "deadline"]));
    expect(index.compare(a, b).score).toBeCloseTo(index.compare(b, a).score);
  });
  it("retains content connections across contrasting emotions", () => {
    const a = entry("a", "Garden flowers and trees. I am happy.");
    const b = entry("b", "Garden flowers and trees. I am sad.");
    const unrelated = { ...entry("c", "A meeting about the budget proposal. I am happy."), mood: "joyful" as const };
    a.mood = "joyful";
    b.mood = "low";
    expect(related(a, [a, b, unrelated]).map(({ entry }) => entry.id)).toEqual(["b"]);
    const baseline = similarity({ ...a, mood: null }, { ...b, mood: null }, []);
    expect(Math.abs(similarity(a, b, []).score - baseline.score)).toBeLessThan(0.05);
  });
  it("does not infer connections from copied prompts, missing transcripts or feeling-only text", () => {
    const prompt = "Tell me about your garden flowers and trees.";
    const a = { ...entry("a", prompt + " I am happy."), prompt };
    const b = { ...entry("b", prompt + " I am happy."), prompt };
    const empty = { ...entry("c", ""), title: "Garden flowers", mode: "video" as const };
    expect(related(a, [a, b, empty])).toEqual([]);
    expect(similarity(entry("d", "I feel sad."), entry("e", "I feel sad."), []).eligible).toBe(false);
  });
  it("caps check-in influence at five percent even when other signals are absent", () => {
    const a = { ...entry("a", "Garden flowers and trees."), mood: "joyful" as const };
    const b = { ...entry("b", "Garden flowers and trees."), mood: "overwhelmed" as const };
    const withoutMoods = similarity({ ...a, mood: null }, { ...b, mood: null }, []);
    const withMoods = similarity(a, b, []);
    expect(withMoods.textEmotion).toBeNull();
    expect(withMoods.face).toBeNull();
    expect(withMoods.eligible).toBe(true);
    expect(Math.abs(withMoods.score - withoutMoods.score)).toBeLessThanOrEqual(0.05);
  });
  it("requires repeated topics on at least three different days and keeps evidence navigable", () => {
    const samples = [
      entry("a", "I planted flowers in the garden.", "2026-10-01"),
      entry("b", "I watered flowers in the garden.", "2026-10-03"),
      entry("c", "Gardening among the flowers.", "2026-10-07"),
      entry("d", "I reviewed a budget proposal.", "2026-10-09"),
    ];
    const patterns = createConnectionIndex(samples).patterns;
    expect(patterns).toHaveLength(1);
    expect(patterns[0].entries.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(patterns[0].days).toBe(3);
    expect(patterns[0].firstDate).toBe("2026-10-01");
    expect(patterns[0].lastDate).toBe("2026-10-07");
    expect(createConnectionIndex(samples.map((sample) => ({ ...sample, date: "2026-10-01" }))).patterns).toEqual([]);
    expect(createConnectionIndex(samples.slice(0, 2)).patterns).toEqual([]);
  });
  it("keeps empty and one-entry journals finite and does not mutate saved data", () => {
    expect(createConnectionIndex([]).patterns).toEqual([]);
    const a = entry("a", "constructor prototype garden");
    const before = JSON.stringify(a);
    expect(createConnectionIndex([a]).rank(a)).toEqual([]);
    expect(Number.isFinite(similarity(a, entry("b", "constructor garden"), []).score)).toBe(true);
    expect(JSON.stringify(a)).toBe(before);
  });
});
