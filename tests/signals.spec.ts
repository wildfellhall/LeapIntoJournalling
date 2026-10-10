import { test, expect, type Page } from "@playwright/test";

async function mockSpeech(page: Page, status: "available" | "downloadable" | "legacy") {
  await page.addInitScript((initial) => {
    const state = { availability: initial, installs: 0, starts: [] as boolean[] };
    (window as any).__speechTest = state;
    class Speech {
      processLocally = false;
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: any;
      onspeechstart: any;
      onend: any;
      onerror: any;
      timer: any;
      static async available(options: any) { if (!options.processLocally) throw new Error("Cloud request"); return state.availability; }
      static async install(options: any) { if (!options.processLocally) throw new Error("Cloud request"); state.installs++; state.availability = "available"; return true; }
      start() {
        state.starts.push(this.processLocally);
        if (!this.processLocally) throw new Error("Cloud recognition must not start");
        this.onspeechstart?.();
        this.timer = setTimeout(() => this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript: "I feel happy." } } } }), 300);
      }
      stop() { clearTimeout(this.timer); this.onend?.(); }
      abort() { clearTimeout(this.timer); }
    }
    const Ctor = initial === "legacy" ? class { start() { throw new Error("Legacy speech started"); } } : Speech;
    Object.defineProperty(window, "SpeechRecognition", { value: Ctor, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: Ctor, configurable: true });
  }, status);
}

test("on-device speech, passage review and emotion corrections survive reload and reach charts", async ({ page }, testInfo) => {
  await mockSpeech(page, "available");
  const external: string[] = [], errors: string[] = [];
  page.on("request", (r) => { if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1")) external.push(r.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /Voice memo/ }).click();
  await page.getByLabel("Live transcription", { exact: true }).check();
  await page.getByRole("textbox", { name: "Entry title", exact: true }).fill("Reviewed voice entry");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Transcript and notes", exact: true })).toHaveValue("I feel happy.");
  await page.getByRole("button", { name: "Stop recording", exact: true }).click();
  await expect(page.getByRole("button", { name: "Complete entry", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__speechTest.starts)).toEqual([true]);
  await page.getByRole("button", { name: "Complete entry", exact: true }).click();
  await page.getByRole("heading", { name: "Reviewed voice entry", exact: true }).click();
  await page.getByRole("button", { name: "Review emotion labels" }).click();
  await page.getByRole("button", { name: "Joy", exact: true }).click();
  await page.getByRole("button", { name: "Fear", exact: true }).click();
  await page.getByRole("button", { name: "Save emotion labels" }).click();
  await expect(page.getByLabel("Emotion review")).toContainText("Confirmed by you");
  await page.getByRole("button", { name: "Review transcript", exact: true }).click();
  await page.getByLabel("Transcript passage 1", { exact: true }).fill("I feel sad.");
  await page.getByRole("button", { name: "Save transcript", exact: true }).click();
  await expect(page.locator(".detail-text")).toHaveText("I feel sad.");
  await page.getByText("Signals by passage", { exact: true }).click();
  await expect(page.getByText("Text: Sadness", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("review-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.reload();
  await page.getByRole("heading", { name: "Reviewed voice entry", exact: true }).click();
  await expect(page.getByLabel("Emotion review").locator("strong").first()).toHaveText("Fear");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  await expect(page.getByRole("table").getByRole("rowheader", { name: "Fear", exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByRole("rowheader", { name: "Sadness", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Download report" }).click();
  await page.getByRole("checkbox").check();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await (await downloading).saveAs(testInfo.outputPath("corrected-report.pdf"));
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(page.getByText("Your labels: Fear", { exact: true })).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("stopping during the local speech availability check prevents late recognition", async ({ page }) => {
  await mockSpeech(page, "available");
  await page.goto("/");
  await page.getByRole("button", { name: /Voice memo/ }).click();
  await page.getByLabel("Live transcription", { exact: true }).check();
  await page.evaluate(() => {
    const ctor = (window as any).SpeechRecognition;
    ctor.available = async () => {
      return new Promise((resolve) => { (window as any).__resolveSpeechCheck = () => resolve("available"); });
    };
  });
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as any).__resolveSpeechCheck)).toBe("function");
  await page.getByRole("button", { name: "Stop recording", exact: true }).click();
  await page.evaluate(() => (window as any).__resolveSpeechCheck());
  await expect(page.getByRole("button", { name: "Record again", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__speechTest.starts)).toEqual([]);
});

test("a speech pack downloads only after an explicit click", async ({ page }) => {
  await mockSpeech(page, "downloadable");
  await page.goto("/");
  await page.getByRole("button", { name: /Voice memo/ }).click();
  await expect(page.getByLabel("Live transcription", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Install English speech pack" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__speechTest.installs)).toBe(0);
  await page.getByRole("button", { name: "Install English speech pack" }).click();
  await expect(page.getByLabel("Live transcription", { exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__speechTest.installs)).toBe(1);
});

test("legacy cloud-capable speech never becomes a fallback", async ({ page }) => {
  await mockSpeech(page, "legacy");
  await page.goto("/");
  await page.getByRole("button", { name: /Voice memo/ }).click();
  await expect(page.getByText("On-device transcription is unavailable here. Add a transcript manually.")).toBeVisible();
  await expect(page.getByLabel("Live transcription", { exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "Transcript and notes", exact: true }).fill("I feel afraid.");
  await page.getByRole("button", { name: "Complete entry", exact: true }).click();
  expect(await page.evaluate(() => (window as any).__speechTest.starts)).toEqual([]);
});
