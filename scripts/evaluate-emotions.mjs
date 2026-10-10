import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
// SSR imports the very same classifier used in the browser, including rules.
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: "custom" });
try {
  const { classifyEmotions, EMOTION_VERSION, emotionDefinitions } = await server.ssrLoadModule("/src/lib/emotions.ts");
  const cases = JSON.parse(await readFile(new URL("./fixtures/journal-regressions.json", import.meta.url), "utf8"));
  const results = cases.map((row) => {
    const prediction = classifyEmotions(row.text);
    const predicted = Object.keys(prediction.emotions).sort();
    return { ...row, predicted, exact: JSON.stringify(predicted) === JSON.stringify([...row.labels].sort()), coverage: prediction.evidence.coverage };
  });
  const perLabel = Object.fromEntries(emotionDefinitions.map(({ id }) => {
    const tp = results.filter((r) => r.labels.includes(id) && r.predicted.includes(id)).length;
    const fp = results.filter((r) => !r.labels.includes(id) && r.predicted.includes(id)).length;
    const fn = results.filter((r) => r.labels.includes(id) && !r.predicted.includes(id)).length;
    return [id, { tp, fp, fn, precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1) }];
  }));
  const report = { version: EMOTION_VERSION, provenance: "Authored synthetic regression scenarios; not blind evaluation or measured accuracy on real journals. Difficult cases are retained, including failures.", total: results.length, exactMatches: results.filter((r) => r.exact).length, perLabel, results };
  await writeFile(new URL("../docs/journal-evaluation.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(`${report.exactMatches}/${report.total} authored scenarios matched exactly. See docs/journal-evaluation.json for failures.`);
} finally { await server.close(); }
