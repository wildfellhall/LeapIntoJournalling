// Local, offline model comparison. Candidate files are supplied explicitly and
// served by Playwright interception, never copied into public/ or the app bundle.
// node scripts/benchmark-face.mjs --candidate /tmp/leap-face-candidate
// Optional --manifest path.json: [{file, label, subject, condition}]. Use only
// consented evaluation images; label is an expression, not a person's feelings.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
const candidate = process.argv.includes("--candidate") ? path.resolve(arg("--candidate")) : null;
const manifestPath = process.argv.includes("--manifest") ? path.resolve(arg("--manifest")) : null;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";
const origin = new URL(baseURL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) throw new Error("This benchmark requires a local Vite dev server.");
const rows = manifestPath ? JSON.parse(await readFile(manifestPath, "utf8")) : [{ file: path.resolve("node_modules/@vladmandic/human/assets/screenshot-facedetect.jpg"), label: null, subject: "unlabeled-package-fixture", condition: "screenshot-smoke-test" }];
if (!Array.isArray(rows) || !rows.length) throw new Error("An image manifest is required.");
const fixtures = await Promise.all(rows.map(async (row, index) => {
  const file = path.resolve(manifestPath ? path.dirname(manifestPath) : ".", row.file);
  const bytes = await readFile(file);
  const mime = /\.png$/i.test(file) ? "image/png" : "image/jpeg";
  return { id: index, label: row.label ?? null, subject: row.subject ?? "unknown", condition: row.condition ?? "unknown", sha256: createHash("sha256").update(bytes).digest("hex"), src: `data:${mime};base64,${bytes.toString("base64")}` };
}));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const name of ["default", ...(candidate ? ["affectnet-mobilenet"] : [])]) {
    const context = await browser.newContext();
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin.origin) return route.abort();
      if (url.pathname.startsWith("/__face_candidate__/")) {
        const filename = path.basename(url.pathname);
        if (!candidate || !["affectnet-mobilenet.json", "affectnet-mobilenet.bin"].includes(filename)) return route.abort();
        return route.fulfill({ path: path.join(candidate, filename), contentType: filename.endsWith("json") ? "application/json" : "application/octet-stream" });
      }
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(baseURL);
    const result = await page.evaluate(async ({ name, fixtures }) => {
      const { default: Human } = await import("/node_modules/@vladmandic/human/dist/human.esm.js");
      const { faceQuality } = await import("/src/lib/mediaSignals.ts");
      const human = new Human({ backend: "webgl", modelBasePath: "/models/", cacheSensitivity: 0, skipAllowed: false,
        face: { enabled: true, detector: { maxDetected: 1, rotation: false }, mesh: { enabled: false }, iris: { enabled: false }, description: { enabled: false }, emotion: { enabled: true, ...(name !== "default" ? { modelPath: "/__face_candidate__/affectnet-mobilenet.json" } : {}) }, antispoof: { enabled: false }, liveness: { enabled: false } },
        body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false } });
      const started = performance.now();
      await human.load();
      const loadMs = performance.now() - started;
      const observations = [];
      for (const fixture of fixtures) {
        const image = new Image(); image.src = fixture.src; await image.decode();
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, 640 / image.width, 480 / image.height);
        canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        await human.detect(canvas); // warm-up excluded
        for (let run = 0; run < 5; run++) {
          const start = performance.now(); const prediction = await human.detect(canvas); const ms = performance.now() - start;
          const face = prediction.face[0]; let quality = 0;
          if (face) {
            const crop = document.createElement("canvas"); crop.width = crop.height = 64;
            const ctx = crop.getContext("2d"); ctx.drawImage(canvas, ...face.box, 0, 0, 64, 64);
            quality = faceQuality(ctx.getImageData(0, 0, 64, 64).data, 64, 64, face, canvas.width, canvas.height).quality;
          }
          observations.push({ id: fixture.id, run, ms, detected: !!face, quality, label: fixture.label, subject: fixture.subject, condition: fixture.condition, emotions: face?.emotion ?? [] });
        }
      }
      return { name, loadMs, observations };
    }, { name, fixtures });
    const times = result.observations.map((o) => o.ms).sort((a, b) => a - b);
    results.push({ ...result, medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor((times.length - 1) * .95)] });
    await context.close();
  }
} finally { await browser.close(); }
const artifacts = candidate ? await Promise.all(["affectnet-mobilenet.json", "affectnet-mobilenet.bin"].map(async (file) => ({ file, bytes: (await stat(path.join(candidate, file))).size, sha256: createHash("sha256").update(await readFile(path.join(candidate, file))).digest("hex") }))) : [];
await writeFile("docs/face-benchmark.json", JSON.stringify({ browser: "Chrome / local WebGL", candidateRevision: candidate ? "bc66dc53bac03c96d35a7e6daaf717e72f3985f5" : null, productionCandidateEnabled: false,
  limitations: "Timing and loading smoke test on an unlabeled library screenshot unless a separate manifest is supplied. No expression-accuracy claim. Quality thresholds are heuristics; no occlusion guarantee. Real lighting, angles, skin tones, cameras and repeated subjects need evaluation before changing the production model.",
  fixtures: fixtures.map(({ src, ...metadata }) => metadata), artifacts, results }, null, 2) + "\n");
console.log(results.map(({ name, medianMs }) => ({ name, medianMs: Math.round(medianMs) })));
