import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("downloads a labeled sample report for the selected range on mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download report" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Explore sample insights" }).click();
  await page.getByLabel("Insights date range").selectOption("7");
  await page.getByRole("button", { name: "Download report" }).click();
  await expect(page.getByText("6 entries · 6 days with entries")).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page
    .getByLabel("Note for the reader")
    .fill("I would like to talk about rest and connection.");
  await page.screenshot({ path: testInfo.outputPath("report-mobile.png") });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^leap-sample-insights-.*\.pdf$/,
  );
  const path = testInfo.outputPath("sample-summary.pdf");
  await download.saveAs(path);
  expect((await readFile(path)).subarray(0, 5).toString()).toBe("%PDF-");
  await expect(page.getByRole("status")).toContainText("Your PDF is ready");
  await page.getByRole("checkbox").check();
  const fullDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await (
    await fullDownload
  ).saveAs(testInfo.outputPath("sample-with-entries.pdf"));
});

test("exports long entries and missing transcripts without uploading journal data", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const entries = Array.from({ length: 45 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const text =
      index === 0
        ? ""
        : index === 1
          ? "Café, Привет, 你好, 🌱. " +
            "A long reflection about work, rest, and relationships. ".repeat(
              160,
            ) +
            "END_OF_LONG_ENTRY"
          : "I felt calm in the garden today.";
    return {
      id: `report-test-${index}`,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      createdAt: date.toISOString(),
      title: `Reflection ${index}`,
      mode: index === 0 ? "voice" : "writing",
      mood: index % 3 ? "calm" : null,
      text,
      analysis: { method: "local-lexicon", score: 0, wordCount: 0, keywords: [], emotions: {} },
      expressions: [],
      decoration: { font: "serif", paper: "cream", highlight: "none", stickers: [], note: "" },
    };
  });
  // Restore through the UI so this check also works against compiled assets.
  await page.getByRole("button", { name: "Settings & your data", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "report-fixtures.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "leap-journal", version: 2, entries })),
  });
  await expect(page.getByRole("dialog")).toContainText("Restored 45 entries");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  await page.getByRole("button", { name: "Download report" }).click();
  await page.getByRole("checkbox").check();
  const externalRequests: string[] = [];
  const appOrigin = new URL(page.url()).origin;
  page.on("request", (request) => {
    if (
      request.url().startsWith("http") &&
      new URL(request.url()).origin !== appOrigin
    )
      externalRequests.push(request.url());
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).not.toContain("sample");
  await download.saveAs(testInfo.outputPath("long-report.pdf"));
  await expect(page.getByRole("status")).toContainText("Your PDF is ready");
  expect(externalRequests).toEqual([]);
});

test("a failed PDF load preserves report choices and explains how to recover", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore a sample journal", exact: true })
    .click();
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByRole("button", { name: "Download report" }).click();
  await page.getByLabel("Note for the reader").fill("Keep this note.");
  await page.route(
    (url) => url.pathname === "/src/lib/insightsPdf.ts" || /^\/assets\/insightsPdf-.*\.js$/.test(url.pathname),
    (route) => route.abort(),
  );
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("couldn't be created");
  await expect(page.getByLabel("Note for the reader")).toHaveValue(
    "Keep this note.",
  );
  await expect(
    page.getByRole("button", { name: "Download PDF", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText("Reload the page");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
