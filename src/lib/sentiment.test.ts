import { describe, expect, it } from "vitest";
import { analyze, upgradeAnalysis, ANALYSIS_VERSION } from "./analysis";
import type { Entry } from "./types";

describe("local VADER sentiment", () => {
  it("matches the published VADER examples for emphasis and intensity", () => {
    for (const [text, score] of [
      ["VADER is smart, handsome, and funny.", 0.8316],
      ["VADER is not smart, handsome, nor funny.", -0.7424],
      ["VADER is smart, handsome, and funny!", 0.8439],
      ["VADER is very smart, handsome, and funny.", 0.8545],
      ["VADER is VERY SMART, handsome, and FUNNY!!!", 0.9342],
      ["The book was kind of good.", 0.3832],
    ] as const)
      expect(analyze(text).score).toBeCloseTo(score, 4);
  });

  it("handles broader vocabulary, intensity, punctuation and emoticons", () => {
    expect(analyze("I am ecstatic.").score).toBeGreaterThan(0);
    expect(analyze("I am devastated.").score).toBeLessThan(0);
    expect(analyze("I am very happy.").score).toBeGreaterThan(
      analyze("I am happy.").score,
    );
    expect(analyze("I am slightly happy.").score).toBeLessThan(
      analyze("I am happy.").score,
    );
    expect(analyze("I am HAPPY!!!").score).toBeGreaterThan(
      analyze("I am happy.").score,
    );
    expect(analyze("A day :)").score).toBeGreaterThan(0);
    expect(analyze("A day :(").score).toBeLessThan(0);
  });

  it("normalizes curly apostrophes and handles common negation cases", () => {
    for (const text of [
      "I don’t feel happy.",
      "I am NOT happy.",
      "There is no hope.",
      "I am no longer happy.",
    ]) {
      expect(analyze(text).score, text).toBeLessThan(0);
    }
    for (const text of [
      "I am not sad.",
      "There are no problems.",
      "I am happy without a doubt.",
      "I am not only happy but also grateful.",
    ]) {
      expect(analyze(text).score, text).toBeGreaterThan(0);
    }
    expect(analyze("I don’t feel happy.").score).toEqual(
      analyze("I don't feel happy.").score,
    );
  });

  it("weights contrast within a sentence without bleeding negation across sentences", () => {
    expect(
      analyze("I had a good day but the evening was awful.").score,
    ).toBeLessThan(0);
    expect(
      analyze("I had an awful day but the evening was good.").score,
    ).toBeGreaterThan(0);
    const a = "I did not.",
      b = "Happy today.";
    const expected = (analyze(a).score * 3 + analyze(b).score * 2) / 5;
    expect(analyze(`${a} ${b}`).score).toBeCloseTo(expected, 5);
    expect(analyze(`${a}\n${b}`).score).toBeCloseTo(expected, 5);
  });

  it("preserves mixed sentiment and handles an entire long entry", () => {
    const mixed = analyze("I am happy. I am sad.");
    expect(mixed.polarity!.positive).toBeGreaterThan(0);
    expect(mixed.polarity!.negative).toBeGreaterThan(0);
    const sentence = "I am happy.";
    expect(analyze(Array(300).fill(sentence).join(" ")).score).toBeCloseTo(
      analyze(sentence).score,
      5,
    );
    const long = analyze(`${"table ".repeat(2000)}devastated`);
    expect(long.wordCount).toBe(2001);
    expect(long.score).toBeLessThan(0);
  });

  it("produces bounded finite scores, preserves text, and versions the estimate", () => {
    for (const text of [
      "",
      "123",
      "你好",
      "🌼",
      "constructor hasOwnProperty __proto__ prototype",
      "I feel AMAZING!!! But exhausted.",
    ]) {
      const analysis = analyze(text);
      expect(Number.isFinite(analysis.score)).toBe(true);
      expect(analysis.score).toBeGreaterThanOrEqual(-1);
      expect(analysis.score).toBeLessThanOrEqual(1);
      expect(
        Object.values(analysis.polarity!).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(1, 5);
      expect(analysis.method).toBe("local-vader-emotion");
      expect(analysis.version).toBe(ANALYSIS_VERSION);
    }
  });

  it("upgrades legacy estimates without mutating the original entry", () => {
    const entry = {
      text: "I am ecstatic.",
      analysis: {
        ...analyze(""),
        method: "local-lexicon",
        version: undefined,
        score: 0,
      },
    } as Entry;
    const upgraded = upgradeAnalysis(entry);
    expect(upgraded.score).toBeGreaterThan(0);
    expect(upgraded.method).toBe("local-vader-emotion");
    expect(entry.analysis.score).toBe(0);
    expect(upgradeAnalysis({ ...entry, analysis: upgraded })).toBe(upgraded);
  });
});
