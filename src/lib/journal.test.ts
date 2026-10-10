import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { analyze, entryScore, related, similarity } from "./analysis";
import { writingPrompts, spokenPrompts, nextPrompt } from "./prompts";
import { deleteEntry, getEntries, importEntries, saveEntries } from "./storage";
import { defaultDecoration, type Entry } from "./types";
import { createSticker } from "./stickers";
const entry = (id: string, text: string): Entry => ({
  id,
  title: id,
  text,
  date: "2026-10-01",
  createdAt: "2026-10-01T12:00:00Z",
  mode: "writing",
  mood: null,
  analysis: analyze(text),
  expressions: [],
  decoration: { ...defaultDecoration, stickers: [] },
});
describe("journal analysis", () => {
  it("handles empty text, positive and negative tone, and negation", () => {
    expect(analyze("").wordCount).toBe(0);
    expect(analyze("").score).toBe(0);
    expect(analyze("I am happy and grateful.").score).toBeGreaterThan(0);
    expect(analyze("I am anxious, sad, and overwhelmed.").score).toBeLessThan(
      0,
    );
    expect(analyze("I am not happy.").score).toBeLessThan(0);
    expect(analyze("I am not sad.").score).toBeGreaterThan(0);
  });
  it("prioritizes a personal check-in over the text estimate", () => {
    const e = { ...entry("self", "I am happy"), mood: "low" as const };
    expect(entryScore(e)).toBe(-0.55);
  });
  it("ranks overlapping content and feelings above unrelated content", () => {
    const a = entry(
      "a",
      "The garden flowers and trees made me happy and peaceful.",
    );
    const b = entry("b", "Happy in the garden with flowers and trees.");
    const c = entry("c", "The work deadline made me anxious and exhausted.");
    expect(related(a, [a, b, c])[0].entry.id).toBe("b");
    expect(related(a, [a, b, c])).toHaveLength(2);
    expect(similarity(a, b, [a, b, c]).score).toBeCloseTo(
      similarity(b, a, [a, b, c]).score,
    );
    expect(similarity(a, b, [a, b, c]).shared).toContain("garden");
  });
  it("does not use legacy expression samples without timing and quality", () => {
    const a = {
      ...entry("face-a", "A day in the garden"),
      expressions: [{ at: 0, scores: { happy: 0.9, sad: 0.1 } }],
    };
    const b = {
      ...entry("face-b", "A day in the garden"),
      expressions: [{ at: 0, scores: { happy: 0.8, sad: 0.2 } }],
    };
    const c = entry("face-c", "A day in the garden");
    expect(similarity(a, b, [a, b, c]).face).toBeNull();
    expect(similarity(a, c, [a, b, c]).face).toBeNull();
  });
  it("handles words that match object property names without corrupting similarity", () => {
    const a = entry("safe-a", "constructor prototype garden");
    const b = entry("safe-b", "constructor garden");
    expect(Number.isFinite(similarity(a, b, [a, b]).score)).toBe(true);
  });
});
describe("prompt library", () => {
  it("contains 120 unique writing and 520 unique shared spoken prompts", () => {
    expect(new Set(writingPrompts).size).toBe(120);
    expect(new Set(spokenPrompts).size).toBe(520);
  });
  it("does not repeat the current prompt", () => {
    expect(nextPrompt("writing", writingPrompts[0])).not.toBe(
      writingPrompts[0],
    );
  });
});
describe("durable browser storage", () => {
  it("round-trips entries, decoration, expression data and media; deletes all entry data", async () => {
    const e = {
      ...entry("roundtrip", "A lovely day"),
      recording: new Blob(["audio data"], { type: "audio/webm" }),
      expressions: [{ at: 2, scores: { happy: 0.8 } }],
      decoration: {
        ...defaultDecoration,
        stickers: [{ ...createSticker("🌼", 0), x: 0.75, y: 0.2, size: 112 }],
        note: "Remember this",
      },
    };
    await saveEntries([e]);
    const saved = (await getEntries()).find((x) => x.id === e.id)!;
    expect(saved.decoration.note).toBe("Remember this");
    expect(saved.decoration.stickers).toEqual(e.decoration.stickers);
    expect(saved.expressions).toEqual(e.expressions);
    expect(await saved.recording?.text()).toBe("audio data");
    await deleteEntry(e.id);
    expect((await getEntries()).some((x) => x.id === e.id)).toBe(false);
  });
  it("restores backup media and rejects invalid files before saving any entries", async () => {
    const good = {
      ...entry("restored", "A peaceful afternoon"),
      recording: "data:audio/webm;base64,YXVkaW8=",
    };
    const file = new File(
      [JSON.stringify({ format: "leap-journal", version: 1, entries: [good] })],
      "backup.json",
    );
    expect(await importEntries(file)).toBe(1);
    expect(
      await (await getEntries())
        .find((e) => e.id === "restored")
        ?.recording?.text(),
    ).toBe("audio");
    const invalid = new File(
      [
        JSON.stringify({
          format: "leap-journal",
          version: 1,
          entries: [entry("never-save", "Hello"), { ...good, mood: "bogus" }],
        }),
      ],
      "invalid.json",
    );
    await expect(importEntries(invalid)).rejects.toThrow();
    expect((await getEntries()).some((e) => e.id === "never-save")).toBe(false);
    const remote = new File(
      [
        JSON.stringify({
          format: "leap-journal",
          version: 1,
          entries: [
            {
              ...good,
              id: "remote",
              recording: "https://example.com/recording",
            },
          ],
        }),
      ],
      "invalid.json",
    );
    await expect(importEntries(remote)).rejects.toThrow();
    expect((await getEntries()).some((e) => e.id === "remote")).toBe(false);
    await deleteEntry("restored");
  });
});
