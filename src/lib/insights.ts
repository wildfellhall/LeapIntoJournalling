import { entryScore } from "./analysis";
import { type Entry, localDate, moods } from "./types";
import { emotionDefinitions } from "./emotions";

export type InsightsRange = "7" | "30" | "90" | "all";
export const rangeLabels: Record<InsightsRange, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};

export function summarizeInsights(
  entries: Entry[],
  range: InsightsRange,
  now = new Date(),
) {
  const end = localDate(now);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (range === "all" ? 0 : Number(range) - 1));
  const start = localDate(cutoff);
  const filtered = entries
    .filter(
      (entry) => range === "all" || (entry.date >= start && entry.date <= end),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const days = new Map<string, Entry[]>();
  for (const entry of filtered)
    days.set(entry.date, [...(days.get(entry.date) || []), entry]);
  const timeline = [...days].map(([date, dayEntries]) => {
    const scored = dayEntries.filter(
      (entry) => entry.mood || entry.text.trim(),
    );
    const checkins = dayEntries.filter((entry) => entry.mood).length;
    return {
      date,
      count: dayEntries.length,
      checkins,
      estimates: scored.length - checkins,
      unscored: dayEntries.length - scored.length,
      words: dayEntries.reduce(
        (sum, entry) => sum + entry.analysis.wordCount,
        0,
      ),
      value: scored.length
        ? Math.round(
            (scored.reduce((sum, entry) => sum + entryScore(entry), 0) /
              scored.length) *
              100,
          )
        : null,
    };
  });
  const wordMoods = moods
    .map((mood, x) => {
      const selected = filtered.filter((entry) => entry.mood === mood.id);
      return {
        ...mood,
        x,
        count: selected.length,
        words: Math.round(
          selected.reduce((sum, entry) => sum + entry.analysis.wordCount, 0) /
            (selected.length || 1),
        ),
      };
    })
    .filter((mood) => mood.count > 0);
  const keywords = new Map<string, number>();
  const emotionDistribution = emotionDefinitions.map((emotion) => {
    const matching = filtered.filter((entry) => (entry.analysis.emotions[emotion.id] || 0) > 0);
    return {
      ...emotion,
      count: matching.length,
      words: matching.length ? Math.round(matching.reduce((sum, entry) => sum + entry.analysis.wordCount, 0) / matching.length) : 0,
    };
  });
  const emotionTimeline = [...days].map(([date, dayEntries]) => ({
    date,
    ...Object.fromEntries(emotionDefinitions.map(({ id }) => [
      id,
      dayEntries.some((entry) => entry.text.trim())
        ? dayEntries.filter((entry) => (entry.analysis.emotions[id] || 0) > 0).length
        : null,
    ])),
  }));
  for (const entry of filtered) {
    for (const word of new Set(entry.analysis.keywords.slice(0, 5))) {
      keywords.set(word, (keywords.get(word) || 0) + 1);
    }
  }
  return {
    filtered,
    range,
    rangeLabel: rangeLabels[range],
    start: range === "all" ? (filtered[0]?.date ?? end) : start,
    end: range === "all" ? (filtered.at(-1)?.date ?? end) : end,
    timeline,
    emotionDistribution,
    emotionTimeline,
    emotionEntries: filtered.filter((entry) => entry.analysis.emotionStatus === "classified").length,
    textEntries: filtered.filter((entry) => entry.text.trim()).length,
    days: days.size,
    totalWords: filtered.reduce(
      (sum, entry) => sum + entry.analysis.wordCount,
      0,
    ),
    checkins: filtered.filter((entry) => entry.mood).length,
    estimates: filtered.filter((entry) => !entry.mood && entry.text.trim())
      .length,
    unscored: filtered.filter((entry) => !entry.mood && !entry.text.trim())
      .length,
    distribution: wordMoods,
    wordMoods,
    themes: [...keywords]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8),
    sample: filtered.some((entry) => entry.demo),
  };
}

export type InsightsSummary = ReturnType<typeof summarizeInsights>;
