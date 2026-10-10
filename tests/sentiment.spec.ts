import { test, expect } from "@playwright/test";

test("sentiment works offline, saves its version and makes no external requests", async ({
  page,
  context,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).hostname !== "127.0.0.1"
    )
      external.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Write an entry", exact: true })
    .click();
  await context.setOffline(true);
  await page
    .getByRole("textbox", { name: "Entry title", exact: true })
    .fill("Local sentiment");
  await page
    .getByRole("textbox", { name: "Journal entry", exact: true })
    .fill("I don’t feel happy. I am devastated.");
  await page
    .getByRole("button", { name: "Complete entry", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Local sentiment", exact: true })
    .click();
  await page.getByText("Explore this entry’s signals", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Leaning negative");
  await expect(page.getByRole("dialog")).toContainText(
    "On-device emotion classifier + VADER tone",
  );
  const saved = await page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const request = indexedDB.open("leap-journal", 1);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("entries")
            .objectStore("entries")
            .getAll();
          read.onsuccess = () => {
            resolve(read.result[0]);
            db.close();
          };
          read.onerror = () => reject(read.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  expect(saved.analysis.method).toBe("local-vader-emotion");
  expect(saved.analysis.version).toBe("vader-1.1.3/sentences-1/goemotions-linear-1/segments-2");
  expect(saved.analysis.emotions.sadness).toBeGreaterThan(0);
  expect(saved.analysis.score).toBeLessThan(0);
  expect(saved.text).toBe("I don’t feel happy. I am devastated.");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("an older backup is rescored locally while retaining the mood and original writing", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Settings & your data", exact: true })
    .click();
  const backup = {
    format: "leap-journal",
    version: 1,
    entries: [
      {
        id: "legacy-sentiment",
        title: "An older entry",
        text: "I am ecstatic.",
        date: "2026-10-01",
        createdAt: "2026-10-01T12:00:00Z",
        mode: "writing",
        mood: "low",
        analysis: {
          score: 0,
          wordCount: 3,
          keywords: [],
          emotions: { positive: 0, negative: 0, neutral: 1 },
          method: "local-lexicon",
        },
        expressions: [],
        decoration: {
          font: "serif",
          paper: "cream",
          highlight: "none",
          stickers: [],
          note: "",
        },
      },
    ],
  };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "old-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(page.getByRole("dialog")).toContainText("Restored 1 entry.");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await page
    .getByRole("heading", { name: "An older entry", exact: true })
    .click();
  await page.getByText("Explore this entry’s signals", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("I am ecstatic.");
  await expect(page.getByRole("dialog")).toContainText("You felt low");
  await expect(page.getByRole("dialog")).toContainText("Leaning positive");
  await expect(page.getByRole("dialog")).toContainText(
    "On-device emotion classifier + VADER tone",
  );
});
