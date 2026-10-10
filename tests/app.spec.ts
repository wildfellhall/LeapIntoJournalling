import { test, expect, type Page } from "@playwright/test";

async function startWriting(
  page: Page,
  title = "A gentle afternoon",
  body = "I feel happy and grateful for the garden, flowers, and time with my friend.",
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s make a little room" }).click();
  await page
    .getByRole("textbox", { name: "Entry title", exact: true })
    .fill(title);
  await page
    .getByRole("textbox", { name: "Journal entry", exact: true })
    .fill(body);
}
test("writing decorations, mood, autosave, durable save, search and detail", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await startWriting(page);
  await page.getByRole("button", { name: "Back to your space", exact: true }).click();
  await page.getByRole("button", { name: "Let’s make a little room" }).click();
  await expect(page.getByRole("textbox", { name: "Entry title", exact: true })).toHaveValue("A gentle afternoon");
  await page.getByLabel("Journal font").selectOption("handwritten");
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page
    .getByRole("button", { name: "Add 🌼 sticker", exact: true })
    .click();
  await page.getByRole("button", { name: "Sticky note", exact: true }).click();
  await page
    .getByLabel("A note in the margin")
    .fill("Keep making room for this.");
  await page.getByRole("button", { name: "Calm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Calm", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(650);
  await page.reload();
  await page.getByRole("button", { name: "Let’s make a little room" }).click();
  await expect(
    page.getByRole("textbox", { name: "Entry title", exact: true }),
  ).toHaveValue("A gentle afternoon");
  await expect(
    page.getByRole("textbox", { name: "Journal entry", exact: true }),
  ).toHaveValue(/happy and grateful/);
  await page.screenshot({
    path: "/tmp/leap-editor.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Complete entry", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A gentle afternoon", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Your journal", exact: false })
    .first()
    .click();
  await page.getByLabel("Search your journal").fill("garden");
  await expect(
    page.getByRole("heading", { name: "A gentle afternoon", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search your journal").fill("missingword");
  await expect(
    page.getByRole("heading", { name: "No moments found." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A gentle afternoon", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Keep making room for this.",
  );
  await expect(page.getByRole("dialog")).toContainText("You felt calm");
  expect(errors).toEqual([]);
});

test("sample journal is isolated and insights, graph, date lookup work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.screenshot({
    path: "/tmp/leap-home.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Explore a sample journal", exact: true })
    .click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Connect Finding joy in the ordinary",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Choose an entry to connect").selectOption("demo-3");
  await expect(
    page.getByRole("heading", {
      name: "The people who feel like home",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Start with a day").fill("2000-01-01");
  await page
    .getByRole("button", { name: "Find connections", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No entries on that date",
  );
  await page.screenshot({
    path: "/tmp/leap-connections.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your emotional landscape" }),
  ).toBeVisible();
  await page.getByLabel("Insights date range").selectOption("7");
  await page.screenshot({
    path: "/tmp/leap-insights.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Back to my journal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every little check-in adds up." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("backup includes entries and restore recovers a deleted entry", async ({
  page,
}) => {
  await startWriting(page, "Keep this memory");
  await page
    .getByRole("button", { name: "Complete entry", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Settings & your data", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download full backup", exact: true })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("heading", { name: "Keep this memory", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A fresh start, just for you." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Settings & your data", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByRole("dialog")).toContainText("Restored 1 entry.");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep this memory", exact: true }),
  ).toBeVisible();
});

for (const mode of ["voice", "video"] as const) {
  test(`${mode} records synthetic media, saves, reloads and plays back`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page
      .getByRole("button", {
        name: mode === "voice" ? /Say it out loud/ : /Show up as you are/,
      })
      .click();
    await page
      .getByRole("button", { name: "Start recording", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Stop recording", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Complete entry", exact: true }),
    ).toBeDisabled();
    await page.waitForTimeout(1500);
    await page
      .getByRole("button", { name: "Stop recording", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Record again", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to your space", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Leaving will discard the recording");
    await page.getByRole("button", { name: "Keep journalling", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Entry title", exact: true })
      .fill(`${mode} moment`);
    await page
      .getByRole("textbox", { name: "Transcript and notes", exact: true })
      .fill("A peaceful afternoon with friends.");
    await page
      .getByRole("button", { name: "Complete entry", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `${mode} moment`, exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("heading", { name: `${mode} moment`, exact: true })
      .click();
    const media = page
      .getByRole("dialog")
      .locator(mode === "voice" ? "audio" : "video");
    await expect(media).toHaveAttribute("src", /^blob:/);
    await expect(
      page.getByRole("button", { name: "Download recording", exact: true }),
    ).toBeVisible();
    await media.evaluate((el: HTMLMediaElement) => el.play());
    await expect
      .poll(() => media.evaluate((el: HTMLMediaElement) => el.currentTime))
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test("mobile layout, navigation and dialogs fit a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: "/tmp/leap-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("button", { name: "Your journal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh start, just for you." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create your first entry", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Put pen to page/ }).click();
  await page
    .getByRole("textbox", { name: "Journal entry", exact: true })
    .fill("A little mobile moment.");
  await page.screenshot({
    path: "/tmp/leap-mobile-editor.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Complete entry", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little piece of today", exact: true }),
  ).toBeVisible();
});

test("permission denial is recoverable and no entry is invented", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Say it out loud/ }).click();
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "permission was declined",
  );
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Back to your space", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your first page is waiting." }),
  ).toBeVisible();
});
