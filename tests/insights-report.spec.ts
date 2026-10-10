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
  await page.evaluate(async () => {
    const storagePath = "/src/lib/storage.ts";
    const typesPath = "/src/lib/types.ts";
    const analysisPath = "/src/lib/analysis.ts";
    const { saveEntries } = await import(storagePath);
    const { defaultDecoration, localDate } = await import(typesPath);
    const { analyze } = await import(analysisPath);
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
        date: localDate(date),
        createdAt: date.toISOString(),
        title: `Reflection ${index}`,
        mode: index === 0 ? "voice" : "writing",
        mood: index % 3 ? "calm" : null,
        text,
        analysis: analyze(text),
        expressions: [],
        decoration: { ...defaultDecoration },
      };
    });
    await saveEntries(entries);
  });
  await page.reload();
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  await page.getByRole("button", { name: "Download report" }).click();
  await page.getByRole("checkbox").check();
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().startsWith("http") &&
      !request.url().startsWith("http://127.0.0.1:5173/")
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
  await page.route("**/src/lib/insightsPdf.ts*", (route) => route.abort());
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
