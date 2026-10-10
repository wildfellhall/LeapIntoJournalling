import { test, expect } from "@playwright/test";

test("connections require content and recurring topics expose supporting entries", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Settings & your data", exact: true }).click();
  const texts = [
    ["Garden one", "I planted flowers in the garden. I am happy.", "2026-10-01"],
    ["Garden two", "I watered flowers in the garden. I am sad.", "2026-10-03"],
    ["Garden three", "Gardening among the flowers. I am afraid.", "2026-10-07"],
    ["Budget meeting", "I reviewed the budget proposal at work. I am happy.", "2026-10-09"],
  ];
  await page.locator("input[type=file]").setInputFiles({
    name: "connections.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "leap-journal", version: 2, entries: texts.map(([id, text, date]) => ({
      id, title: id, text, date, createdAt: date + "T12:00:00Z", mode: "writing", mood: "calm",
      analysis: { method: "local-lexicon", score: 0, wordCount: 1, keywords: [], emotions: {} },
      expressions: [], decoration: { font: "serif", paper: "cream", highlight: "none", stickers: [], note: "" },
    })) })),
  });
  await expect(page.getByRole("dialog")).toContainText("Restored 4 entries");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByLabel("Choose an entry to connect").selectOption("Garden one");
  await expect(page.locator(".graph-node")).toHaveCount(3);
  await expect(page.locator(".related-item")).toHaveCount(2);
  await expect(page.locator(".related-item").first()).toContainText("Shared topics:");
  await expect(page.getByRole("button", { name: "Connect Budget meeting", exact: true })).toHaveCount(0);
  const patterns = page.getByRole("region", { name: "Recurring topics" });
  await expect(patterns).toContainText("3 entries · 3 days");
  await patterns.locator("summary").click();
  await expect(patterns.getByRole("button")).toHaveCount(3);
  await patterns.getByRole("button", { name: /Garden two/ }).click();
  await expect(page.getByRole("dialog")).toContainText("I watered flowers");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Connect Garden two", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Choose an entry to connect")).toHaveValue("Garden two");
  await page.getByLabel("Choose an entry to connect").selectOption("Budget meeting");
  await expect(page.locator(".graph-node")).toHaveCount(1);
  await expect(page.locator(".graph-canvas > svg > g > line")).toHaveCount(0);
  await expect(page.getByText("No clear content connections yet. A shared mood alone does not create a link.")).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel("Choose an entry to connect").selectOption("Garden one");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const contained = await page.locator(".graph-canvas").evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      return [...canvas.querySelectorAll(".graph-node circle")].every((circle) => {
        const rect = circle.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
      });
    });
    expect(contained).toBe(true);
  }
  expect(errors).toEqual([]);
});
