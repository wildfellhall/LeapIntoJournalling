import { test, expect, type Page } from "@playwright/test";

async function restore(page: Page, samples: { id: string; text: string; mode?: string }[]) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings & your data", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "emotion-test.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "leap-journal", version: 2,
      entries: samples.map(({ id, text, mode = "writing" }) => ({
        id, title: id, text, mode, date: "2026-10-10", createdAt: "2026-10-10T12:00:00Z", mood: null,
        analysis: { method: "local-vader", version: "old", score: -0.5, wordCount: 1, keywords: [], emotions: { negative: 1 } },
        expressions: [], decoration: { font: "serif", paper: "cream", highlight: "none", stickers: [], note: "" },
      })),
    })),
  });
  await expect(page.getByRole("dialog")).toContainText(`Restored ${samples.length}`);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}

test("emotion estimates reach insights and graph without requiring mood check-ins", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await restore(page, [
    { id: "Mixed day", text: "I feel happy and grateful. I am sad and lonely." },
    { id: "Voice reflection", text: "I am afraid and nervous.", mode: "voice" },
    { id: "Video reflection", text: "I am angry and frustrated.", mode: "video" },
    { id: "Factual note", text: "I filed the document." },
  ]);
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  await expect(page.getByRole("heading", { name: "Text emotions over time", exact: true })).toBeVisible();
  await expect(page.getByText("3 of 4 entries with text have an emotion estimate.", { exact: false })).toBeVisible();
  const table = page.getByRole("table");
  for (const label of ["Joy", "Sadness", "Fear", "Anger"])
    await expect(table.getByRole("rowheader", { name: label, exact: true })).toBeVisible();
  await expect(page.getByText("Add mood check-ins to see their distribution.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("emotion-insights-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Text emotion distribution", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("emotion-insights-mobile.png"), animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByLabel("Choose an entry to connect").selectOption("Mixed day");
  await expect(page.getByText("Text estimate: Joy, Sadness", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Color graph nodes by")).toHaveValue("emotion");
  const node = page.getByRole("button", { name: "Connect Mixed day", exact: true });
  await expect(node.locator("circle").last()).toHaveAttribute("fill", "#edd28f");
  await page.getByLabel("Color graph nodes by").selectOption("mood");
  await expect(node.locator("circle").last()).toHaveAttribute("fill", "#dde7db");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("emotion-connections-mobile.png"), animations: "disabled" });
  expect(errors).toEqual([]);
});

test("uncertain text and missing transcripts leave emotion charts empty", async ({ page }) => {
  await restore(page, [
    { id: "Factual note", text: "I filed the document." },
    { id: "Recording", text: "", mode: "voice" },
  ]);
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  await expect(page.getByText("No clear text emotions in this date range.")).toBeVisible();
  await expect(page.getByText("0 of 1 entries with text have an emotion estimate.", { exact: false })).toBeVisible();
});
