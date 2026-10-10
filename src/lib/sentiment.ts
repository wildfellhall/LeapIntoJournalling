import { SentimentIntensityAnalyzer } from "vader-sentiment";

// The package and our preprocessing/aggregation are versioned together so saved
// estimates can be upgraded without changing the original writing or check-in.
export const SENTIMENT_VERSION = "vader-1.1.3/sentences-1";
const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("en", { granularity: "sentence" })
    : null;

function normalize(text: string) {
  return (
    text
      .normalize("NFC")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      // The JS port checks these context words case-sensitively. Preserve the
      // casing of sentiment words and intensifiers for VADER's emphasis rules.
      .replace(
        /\b(?:not|never|nothing|neither|nor|without|rarely|seldom|least|at|but|so|this|[a-z]+n't)\b/gi,
        (word) => word.toLowerCase(),
      )
      .replace(/\bwithout (?:a )?doubt\b/gi, "")
      .replace(/\bnot only\b/gi, "")
      .replace(/\bno longer\b/gi, "not")
      // This older JS port treats "no" as a sentiment word instead of negation.
      // Keep standalone "no", but recognize "no hope" and "no problems".
      .replace(/\bno(?=\s+[a-z])/gi, "not")
  );
}

export function assessSentiment(text: string) {
  let weight = 0,
    score = 0,
    positive = 0,
    negative = 0,
    neutral = 0;
  for (const paragraph of text.split(/\n+/u)) {
    const sentences = segmenter
      ? Array.from(segmenter.segment(paragraph), ({ segment }) => segment)
      : paragraph.split(/(?<=[.!?])\s+/u);
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/u).filter(Boolean);
      // Bound work for pasted transcripts/run-on entries; process every word.
      // Sentence boundaries also keep negation and "but" from affecting later sentences.
      for (let i = 0; i < words.length; i += 400) {
        const chunk = words.slice(i, i + 400);
        const result = SentimentIntensityAnalyzer.polarity_scores(
          normalize(chunk.join(" ")),
        );
        const total = result.pos + result.neg + result.neu;
        weight += chunk.length;
        score += result.compound * chunk.length;
        positive += (total ? result.pos / total : 0) * chunk.length;
        negative += (total ? result.neg / total : 0) * chunk.length;
        neutral += (total ? result.neu / total : 1) * chunk.length;
      }
    }
  }
  return {
    score: weight ? score / weight : 0,
    // These are lexical proportions, not probabilities of the writer's emotions.
    polarity: weight
      ? {
          positive: positive / weight,
          negative: negative / weight,
          neutral: neutral / weight,
        }
      : { positive: 0, negative: 0, neutral: 1 },
  };
}
