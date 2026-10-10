import { expect, test, type Locator, type Page } from "@playwright/test";

async function restore(page: Page, entries: { id: string; text: string; date: string; mode?: string }[]) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings & your data", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "graph-fixtures.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "leap-journal", version: 2, entries: entries.map((entry) => ({
      ...entry, title: entry.id, mode: entry.mode ?? "writing", mood: null,
      createdAt: entry.date + "T12:00:00Z",
      analysis: { method: "local-lexicon", score: 0, wordCount: 0, keywords: [], emotions: {} },
      expressions: [], decoration: { font: "serif", paper: "cream", highlight: "none", stickers: [], note: "" },
    })) })),
  });
  await expect(page.getByRole("dialog")).toContainText(`Restored ${entries.length}`);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
}

async function visibleNode(node: Locator) {
  return node.evaluate((element) => {
    const viewport = element.closest(".graph-canvas")!.getBoundingClientRect();
    const circle = element.querySelector("circle:last-of-type")!.getBoundingClientRect();
    return circle.width > 0 && circle.left >= viewport.left && circle.right <= viewport.right &&
      circle.top >= viewport.top && circle.bottom <= viewport.bottom;
  });
}

test("charts render real marks across resizing, filtering and navigation", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByRole("button", { name: "Explore sample connections", exact: true }).click();
  await expect(page.getByLabel("Entry date")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  const charts = [
    ["Daily counts of entries expressing joy, sadness, anger, fear, disgust and surprise", ".recharts-line-dot"],
    ["Entry counts by estimated text emotion", ".recharts-rectangle"],
    ["Line chart of daily mood scores", ".recharts-area-dot"],
    ["Distribution of mood check-ins", ".recharts-sector"],
    ["Average word counts by mood check-in", ".recharts-symbols"],
  ];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, marks] of charts) {
      const chart = page.getByRole("img", { name, exact: true });
      await expect(chart.locator(".recharts-surface")).toBeVisible();
      await expect.poll(() => chart.evaluate((element, selector) => {
        const box = element.getBoundingClientRect();
        const svg = element.querySelector(".recharts-surface")!.getBoundingClientRect();
        const data = [...element.querySelectorAll<SVGGraphicsElement>(selector)];
        return svg.width > 150 && svg.height > 150 && Math.abs(svg.width - box.width) < 2 &&
          data.length > 0 && data.every((mark) => !/NaN|Infinity|undefined/.test(mark.getAttribute("d") ?? "")) &&
          data.some((mark) => { const b = mark.getBBox(); return b.width > 0 && b.height > 0; });
      }, marks)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440 || width === 320) {
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: testInfo.outputPath(`charts-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }
  const moodDots = page.getByRole("img", { name: "Line chart of daily mood scores", exact: true }).locator(".recharts-area-dot");
  await expect(moodDots).toHaveCount(10);
  await page.getByLabel("Insights date range").selectOption("7");
  await expect(moodDots).toHaveCount(6);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(moodDots).toHaveCount(10);
  expect(errors).toEqual([]);
});

test("all eight connections remain reachable when zoomed, without check-ins", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await restore(page, [
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `Garden ${index}`, date: `2026-10-${String(index + 1).padStart(2, "0")}`,
      text: `I planted flowers and trees in the garden. ${index % 2 ? "I am sad." : "I am happy."}`,
      mode: ["writing", "voice", "video"][index % 3],
    })),
    { id: "Unrelated", date: "2026-10-10", text: "A budget proposal for the office. I am happy." },
  ]);
  await page.reload();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.getByLabel("Choose an entry to connect").selectOption("Garden 0");
  await expect(page.locator(".graph-node")).toHaveCount(9);
  await expect(page.locator(".related-item")).toHaveCount(8);
  await expect(page.locator(".connection-edge:not(.connection-edge-secondary)")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Connect Unrelated", exact: true })).toHaveCount(0);
  const endpointsMatch = await page.locator(".graph-canvas").evaluate((canvas) => {
    const nodes = new Map([...canvas.querySelectorAll(".graph-node")].map((node) => [node.getAttribute("data-entry-id"), node.querySelector("circle:last-of-type")!]));
    return [...canvas.querySelectorAll(".connection-edge")].every((edge) => {
      const source = nodes.get(edge.getAttribute("data-source")), target = nodes.get(edge.getAttribute("data-target"));
      return source && target && edge.getAttribute("x1") === source.getAttribute("cx") &&
        edge.getAttribute("y1") === source.getAttribute("cy") && edge.getAttribute("x2") === target.getAttribute("cx") &&
        edge.getAttribute("y2") === target.getAttribute("cy");
    });
  });
  expect(endpointsMatch).toBe(true);
  const relatedTitles = await page.locator(".related-item h4").allTextContents();
  for (let i = 0; i < relatedTitles.length; i++) {
    await expect(page.getByRole("button", { name: `Connect ${relatedTitles[i]}`, exact: true }).locator("text").first()).toHaveText(String(i + 1));
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Reset graph zoom", exact: true }).click();
    for (const node of await page.locator(".graph-node").all()) expect(await visibleNode(node)).toBe(true);
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Zoom in", exact: true })).toBeDisabled();
    // Keyboard focus must bring every enlarged node into view, without clipping.
    for (const node of await page.locator(".graph-node").all()) {
      await node.focus();
      await expect.poll(() => visibleNode(node)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Reset graph zoom", exact: true }).click();
    await expect(page.getByRole("button", { name: "Zoom out", exact: true })).toBeDisabled();
    for (const node of await page.locator(".graph-node").all()) expect(await visibleNode(node)).toBe(true);
    if (width === 1440 || width === 320) {
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: testInfo.outputPath(`connections-${width}.png`), fullPage: true, animations: "disabled" });
    }
  }
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Connect Garden 1", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Choose an entry to connect")).toHaveValue("Garden 1");
  await expect(page.getByRole("button", { name: "Zoom out", exact: true })).toBeDisabled();
  for (const node of await page.locator(".graph-node").all()) expect(await visibleNode(node)).toBe(true);
  await page.getByLabel("Entry date").fill("2026-10-03");
  await page.getByRole("button", { name: "Find connections", exact: true }).click();
  await expect(page.getByLabel("Choose an entry to connect")).toHaveValue("Garden 2");
  expect(errors).toEqual([]);
});

test("missing signals show an explanation and one untagged entry still renders chart data", async ({ page }) => {
  await restore(page, [{ id: "No transcript", date: "2026-10-10", text: "", mode: "voice" }]);
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  await expect(page.getByText("Add a mood check-in, writing, or a transcript to see this timeline.")).toBeVisible();
  await expect(page.locator(".recharts-surface")).toHaveCount(0);
  await restore(page, [{ id: "A single day", date: "2026-10-09", text: "I am happy about the garden flowers." }]);
  await page.reload();
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByLabel("Insights date range").selectOption("all");
  const mood = page.getByRole("img", { name: "Line chart of daily mood scores", exact: true });
  await expect(mood.locator(".recharts-area-dot")).toHaveCount(1);
  await expect(mood.locator(".recharts-area-dot")).toBeVisible();
  await expect(page.getByRole("img", { name: "Entry counts by estimated text emotion", exact: true }).locator(".recharts-rectangle")).toHaveCount(1);
  await expect(page.getByText("Add mood check-ins to see their distribution.")).toBeVisible();
});
