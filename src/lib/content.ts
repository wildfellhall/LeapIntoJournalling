import type { Entry } from "./types";

// Small, inspectable English vocabulary; no model download or remote embedding.
export const sentimentTerms = new Set(
  "happy happiness joyful joy excited excitement wonderful love loved loving amazing grateful gratitude thankful proud peaceful peace calm content hope hopeful good great beautiful kind kindness safe connected connection laugh laughed laughter smile smiled enjoy enjoyed fun relieved relief relaxed supported support inspired optimistic better growth progress accomplished cozy rested sad sadness unhappy lonely alone hurt pain painful grief grieving depressed hopeless awful terrible hate hated angry anger furious anxious anxiety worried worry nervous fear afraid scared stressed stress overwhelmed exhausted tired frustrated frustration disappointed difficult hard failed failure guilt guilty shame upset cry cried delighted ecstatic disgust disgusted surprised surprise miserable devastated terrified".split(" "),
);
export const stopwords = new Set(
  "a an the i me my mine myself we our ours you your yours he she it its they them their and or but so to of in on at by for from with is am are was were be been being have has had do does did can could will would should may might this that these those as if than then when while where why how not no never very just really more most much many some any all each every one two also about into out up down today yesterday tomorrow day days feel felt feeling feelings get got going went go thing things want wanted know think time like little still something don t s ve ll m re didn doesn isn wasn couldn wouldn shouldn journal entry untitled note notes reflection moment morning afternoon evening week month year again after before through because there here back made make making spent way bit lot seem seemed take took taking".split(" "),
);
const aliases = new Map<string, string>();
for (const word of "new next last finally actually sometimes often usual quite enough even need needed notice noticed end less tiny right now could cannot tried trying try help helped".split(" ")) stopwords.add(word);
for (const [canonical, variants] of Object.entries({
  garden: "garden gardens gardening gardened",
  flower: "flower flowers flowering bloom blooms",
  tree: "tree trees",
  plant: "plant plants planting planted",
  walk: "walk walks walking walked stroll strolls strolled strolling",
  run: "run runs running ran jog jogging jogged",
  exercise: "exercise exercises exercising exercised workout workouts",
  sleep: "sleep sleeps sleeping slept bedtime insomnia",
  work: "work works working worked workplace office job jobs",
  meeting: "meeting meetings",
  deadline: "deadline deadlines",
  manager: "manager managers boss bosses supervisor supervisors",
  colleague: "colleague colleagues coworker coworkers teammate teammates",
  friend: "friend friends friendship friendships",
  family: "family families",
  mother: "mother mothers mom mum",
  father: "father fathers dad",
  child: "child children kid kids",
  partner: "partner partners spouse spouses",
  conversation: "conversation conversations chat chats chatted chatting",
  argument: "argument arguments argued arguing disagreement disagreements",
  study: "study studies studying studied revision revising",
  exam: "exam exams examination examinations test tests",
  school: "school schools classroom classrooms",
  travel: "travel travels travelling traveling traveled travelled trip trips",
  cook: "cook cooks cooking cooked",
  meal: "meal meals dinner dinners lunch lunches breakfast breakfasts",
  read: "read reads reading book books novel novels",
  music: "music musical song songs",
  paint: "paint paints painting painted paintings",
  rent: "rent rental",
  money: "money finances finance financial budget budgeting",
})) for (const word of variants.split(" ")) aliases.set(word, canonical);

function normalize(word: string) {
  const plain = word.replace(/'(s|t|ve|re|ll|d|m)$/u, "");
  if (aliases.has(plain)) return aliases.get(plain)!;
  if (plain.length > 5 && plain.endsWith("ies")) return plain.slice(0, -3) + "y";
  if (plain.length > 5 && plain.endsWith("sses")) return plain.slice(0, -2);
  if (plain.length > 4 && plain.endsWith("s") && !/(ss|us|is)$/u.test(plain)) return plain.slice(0, -1);
  return plain;
}
function words(text: string) {
  return (text.toLowerCase().replace(/[‘’]/gu, "'").match(/[a-z]+(?:'[a-z]+)?/gu) ?? [])
    .map((word) => ({ word, key: normalize(word) }))
    .filter(({ word, key }) => key.length > 2 && !stopwords.has(word) && !stopwords.has(key) && !sentimentTerms.has(word) && !sentimentTerms.has(key));
}
function features(text: string) {
  const counts = new Map<string, number>();
  const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  // Never join a phrase across sentences. Adjacent substantive words form a phrase.
  for (const sentence of text.split(/[.!?;\n]+/u)) {
    const terms = words(sentence);
    for (let i = 0; i < terms.length; i++) {
      add(terms[i].key);
      if (i && terms[i - 1].key !== terms[i].key) add(`${terms[i - 1].key} ${terms[i].key}`);
    }
  }
  return counts;
}
export function contentFeatures(entry: Entry) {
  // The same writing prompt pasted into entries must not manufacture a pattern.
  const text = entry.prompt ? entry.text.split(entry.prompt).join(" ") : entry.text;
  const body = features(text);
  const title = features(entry.title);
  return { body, title };
}
export interface RecurringPattern {
  term: string;
  entries: Entry[];
  days: number;
  firstDate: string;
  lastDate: string;
}

export function createContentIndex(entries: Entry[]) {
  const documents = new Map(entries.map((entry) => [entry.id, contentFeatures(entry)]));
  const frequency = new Map<string, number>();
  for (const { body } of documents.values()) for (const key of body.keys()) frequency.set(key, (frequency.get(key) ?? 0) + 1);
  const idf = (key: string) => 1 + Math.log((1 + documents.size) / (1 + (frequency.get(key) ?? 0)));
  const vectors = new Map<string, Map<string, number>>();
  for (const [id, { body, title }] of documents) {
    const vector = new Map<string, number>();
    for (const key of new Set([...body.keys(), ...title.keys()])) {
      const count = (body.get(key) ?? 0) + 0.25 * (title.get(key) ?? 0);
      vector.set(key, Math.log1p(count) * idf(key) * (key.includes(" ") ? 1.25 : 1));
    }
    // Normalize words separately so unique phrases do not drown out shared topics.
    const wordNorm = Math.sqrt([...vector].filter(([key]) => !key.includes(" ")).reduce((sum, [, value]) => sum + value * value, 0)) || 1;
    const phraseNorm = Math.sqrt([...vector].filter(([key]) => key.includes(" ")).reduce((sum, [, value]) => sum + value * value, 0)) || 1;
    for (const [key, value] of vector) vector.set(key, value / (key.includes(" ") ? phraseNorm : wordNorm));
    vectors.set(id, vector);
  }
  function compare(a: Entry, b: Entry) {
    const av = vectors.get(a.id)!, bv = vectors.get(b.id)!;
    const ad = documents.get(a.id)!.body, bd = documents.get(b.id)!.body;
    const shared = [...ad.keys()].filter((key) => bd.has(key))
      .sort((x, y) => idf(y) - idf(x) || x.localeCompare(y));
    const terms = shared.filter((key) => !key.includes(" "));
    const phrases = shared.filter((key) => key.includes(" "));
    const words = [...av].filter(([key]) => !key.includes(" ")).reduce((sum, [key, value]) => sum + value * (bv.get(key) ?? 0), 0);
    const phraseScore = [...av].filter(([key]) => key.includes(" ")).reduce((sum, [key, value]) => sum + value * (bv.get(key) ?? 0), 0);
    const hasPhrases = [...av.keys()].some((key) => key.includes(" ")) && [...bv.keys()].some((key) => key.includes(" "));
    const content = Math.min(1, hasPhrases ? 0.8 * words + 0.2 * phraseScore : words);
    // Titles, emotions and check-ins cannot create an edge without content evidence.
    const distinctive = terms.some((key) => documents.size < 5 || (frequency.get(key) ?? 0) / documents.size <= 0.8);
    const eligible = content >= 0.08 && (terms.length >= 2 || phrases.length > 0 || (distinctive && content >= 0.32));
    return { content, eligible, shared: terms, phrases };
  }
  function patterns(): RecurringPattern[] {
    const candidates = [...frequency].filter(([, count]) => count >= 3).map(([term]) => {
      const matching = entries.filter((entry) => documents.get(entry.id)!.body.has(term));
      const dates = [...new Set(matching.map((entry) => entry.date))].sort();
      return { term, entries: matching, days: dates.length, firstDate: dates[0], lastDate: dates.at(-1)! };
    }).filter((pattern) => pattern.days >= 3)
      .sort((a, b) => b.days - a.days || Number(b.term.includes(" ")) - Number(a.term.includes(" ")) || a.term.localeCompare(b.term));
    const distinct: RecurringPattern[] = [];
    for (const candidate of candidates) {
      // Avoid several cards describing essentially the same group of entries.
      const ids = new Set(candidate.entries.map((entry) => entry.id));
      if (distinct.some((pattern) => {
        const intersection = pattern.entries.filter((entry) => ids.has(entry.id)).length;
        return intersection / (ids.size + pattern.entries.length - intersection) >= 0.7;
      })) continue;
      distinct.push(candidate);
      if (distinct.length === 6) break;
    }
    return distinct;
  }
  return { compare, patterns };
}
