import { describe, expect, it } from "vitest";
import { analyze } from "./analysis";
import { summarizeInsights } from "./insights";
import { createReportDefinition } from "./insightsPdf";
import { reportText } from "./reportText";
import { defaultDecoration, type Entry } from "./types";

const now = new Date(2026, 9, 10, 12);
const entry = (
  id: string,
  date: string,
  text = "A happy afternoon",
): Entry => ({
  id,
  date,
  title: `Private title ${id}`,
  text,
  createdAt: `${date}T12:00:00Z`,
  mode: "writing",
  mood: null,
  analysis: analyze(text),
  expressions: [],
  decoration: { ...defaultDecoration },
});

describe("insights report data", () => {
  it("uses inclusive local date boundaries and keeps the source entries unchanged", () => {
    const entries = [
      entry("today", "2026-10-10"),
      entry("old", "2026-10-03"),
      entry("first", "2026-10-04"),
      entry("future", "2026-10-11"),
    ];
    expect(
      summarizeInsights(entries, "7", now).filtered.map((e) => e.id),
    ).toEqual(["first", "today"]);
    expect(entries.map((e) => e.id)).toEqual([
      "today",
      "old",
      "first",
      "future",
    ]);
    const all = summarizeInsights(entries, "all", now);
    expect([all.start, all.end]).toEqual(["2026-10-03", "2026-10-11"]);
    expect(all.filtered).toHaveLength(4);
  });

  it("separates self-reports, text estimates and missing signals, averaging only available values", () => {
    const self = {
      ...entry("self", "2026-10-10", "sad"),
      mood: "joyful" as const,
    };
    const estimated = entry("estimated", "2026-10-10", "happy");
    const blank = entry("blank", "2026-10-10", "");
    const missingDay = entry("missing", "2026-10-09", "");
    const summary = summarizeInsights(
      [blank, estimated, self, missingDay],
      "7",
      now,
    );
    expect(summary.checkins).toBe(1);
    expect(summary.estimates).toBe(1);
    expect(summary.unscored).toBe(2);
    expect(summary.timeline[0].value).toBeNull();
    expect(summary.timeline[1].value).toBe(
      Math.round(((1 + estimated.analysis.score) / 2) * 100),
    );
    expect(summary.distribution[0]).toMatchObject({
      id: "joyful",
      count: 1,
      words: 1,
    });
    expect(summary.totalWords).toBe(2);
  });

  it("counts each recurring word once per entry, including object-property names", () => {
    const a = entry("a", "2026-10-10");
    a.analysis.keywords = ["constructor", "garden", "garden"];
    const b = entry("b", "2026-10-10");
    b.analysis.keywords = ["garden"];
    expect(summarizeInsights([a, b], "30", now).themes).toEqual([
      ["garden", 2],
      ["constructor", 1],
    ]);
  });

  it("summarizes multi-label emotions across modes without changing self-reported moods", () => {
    const mixed = entry("mixed", "2026-10-10", "I feel happy and grateful. I am sad and lonely.");
    mixed.mood = "calm";
    const voice = { ...entry("voice", "2026-10-09", "I am sad and lonely."), mode: "voice" as const };
    const video = { ...entry("video", "2026-10-09", "I am afraid and nervous."), mode: "video" as const };
    const unknown = entry("unknown", "2026-10-10", "I filed the document.");
    const missing = entry("missing", "2026-10-08", "");
    const summary = summarizeInsights([mixed, voice, video, unknown, missing], "7", now);
    expect(summary.emotionEntries).toBe(3);
    expect(summary.textEntries).toBe(4);
    expect(summary.emotionDistribution.find((emotion) => emotion.id === "sadness")).toMatchObject({ count: 2, words: 8 });
    expect(summary.emotionDistribution.find((emotion) => emotion.id === "fear")?.count).toBe(1);
    expect(summary.emotionTimeline[0]).toMatchObject({ sadness: null, joy: null });
    expect(summary.emotionTimeline[2]).toMatchObject({ sadness: 1, joy: 1, fear: 0 });
    expect(summary.distribution).toMatchObject([{ id: "calm", count: 1 }]);
    const report = JSON.stringify(createReportDefinition(summary, { includeEntries: false, note: "" }, now));
    expect(report).toContain("Text emotion estimates");
    expect(report).toContain("Sadness");
    expect(report).not.toContain(mixed.text);
  });
});

describe("PDF report content", () => {
  it("excludes private titles and journal text by default and includes only opted-in text", () => {
    const personal = {
      ...entry("one", "2026-10-10", "PRIVATE_BODY café Привет 🌱"),
      prompt: "PRIVATE_PROMPT",
      decoration: { ...defaultDecoration, note: "PRIVATE_NOTE" },
      expressions: [{ at: 1, scores: { PRIVATE_EXPRESSION: 0.9 } }],
    };
    const summary = summarizeInsights([personal], "30", now);
    const basic = JSON.stringify(
      createReportDefinition(
        summary,
        { includeEntries: false, note: "My context" },
        now,
      ),
    );
    expect(basic).toContain("My context");
    expect(basic).not.toContain("Private title");
    expect(basic).not.toContain("PRIVATE_BODY");
    const full = JSON.stringify(
      createReportDefinition(summary, { includeEntries: true, note: "" }, now),
    );
    expect(full).toContain("Private title one");
    expect(full).toContain("PRIVATE_BODY café Привет [U+1F331]");
    for (const value of [
      "PRIVATE_NOTE",
      "PRIVATE_PROMPT",
      "PRIVATE_EXPRESSION",
    ])
      expect(full).not.toContain(value);
  });

  it("labels sample data and handles a recording without a transcript", () => {
    const summary = summarizeInsights(
      [{ ...entry("sample", "2026-10-10", ""), mode: "voice", demo: true }],
      "all",
      now,
    );
    const report = JSON.stringify(
      createReportDefinition(summary, { includeEntries: true, note: "" }, now),
    );
    expect(report).toContain("SAMPLE DATA");
    expect(report).toContain("No text or transcript was saved");
    expect(report).toContain("1 without a score");
  });

  it("rejects an empty report and preserves unsupported Unicode as explicit code points", () => {
    expect(() =>
      createReportDefinition(
        summarizeInsights([], "7", now),
        { includeEntries: false, note: "" },
        now,
      ),
    ).toThrow("no entries");
    expect(reportText("café\nПривет\n你好 🌱")).toBe(
      "café\nПривет\n[U+4F60][U+597D] [U+1F331]",
    );
  });
});
