import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function start(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Write an entry", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Entry title", exact: true })
    .fill("Sticker layout");
  await page
    .getByRole("textbox", { name: "Journal entry", exact: true })
    .fill("An afternoon spent drawing flowers and drinking tea.");
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
}

async function drag(page: Page, target: Locator, dx: number, dy: number) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dx,
    box.y + box.height / 2 + dy,
    { steps: 12 },
  );
  await page.mouse.up();
}

test("stickers move and resize, survive drafts and saves, and round-trip through backups", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page
    .getByRole("button", { name: "Add 🌼 sticker", exact: true })
    .click();
  const sticker = page.getByRole("button", { name: "🌼 sticker", exact: true });
  await sticker.scrollIntoViewIfNeeded();
  const before = (await sticker.boundingBox())!;
  await drag(page, sticker, 170, -150);
  const after = (await sticker.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(170, 0);
  expect(after.y - before.y).toBeCloseTo(-150, 0);
  await drag(
    page,
    page.getByRole("button", { name: "Resize 🌼 sticker", exact: true }),
    36,
    36,
  );
  await expect(
    page.getByRole("slider", { name: "Sticker size", exact: true }),
  ).toHaveValue("100");
  const positioned = page.locator(".sticker-node").first();
  const layout = await positioned.getAttribute("style");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("leap-draft-writing") || "{}")
            .decoration?.stickers[0]?.size,
      ),
    )
    .toBe(100);
  await page.reload();
  await page
    .getByRole("button", { name: "Write an entry", exact: true })
    .click();
  await expect(positioned).toHaveAttribute("style", layout!);
  await expect(sticker).toBeVisible();
  await page
    .getByRole("button", { name: "Complete entry", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sticker layout", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("heading", { name: "Sticker layout", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "🌼 sticker", exact: true }),
  ).toBeVisible();
  await expect(positioned).toHaveAttribute("style", layout!);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Settings & your data", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download full backup", exact: true })
    .click();
  const path = (await (await download).path())!;
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.version).toBe(2);
  expect(backup.entries[0].decoration.stickers[0]).toMatchObject({
    emoji: "🌼",
    size: 100,
  });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("heading", { name: "Sticker layout", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Settings & your data", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles(path);
  await expect(page.getByRole("dialog")).toContainText("Restored 1 entry.");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: /^Your journal/ }).click();
  await page
    .getByRole("heading", { name: "Sticker layout", exact: true })
    .click();
  await expect(positioned).toHaveAttribute("style", layout!);
  expect(errors).toEqual([]);
});

test("catalog, keyboard controls, duplicate stickers and limits", async ({
  page,
}) => {
  await start(page);
  for (const category of ["Nature", "Food", "Little things", "Sky & hearts"]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(page.locator(".sticker-option")).toHaveCount(12);
  }
  await page
    .getByRole("button", { name: "Add 🌙 sticker", exact: true })
    .click();
  const sticker = page.getByRole("button", { name: "🌙 sticker", exact: true });
  await sticker.focus();
  const before = await page.locator(".sticker-node").getAttribute("style");
  await sticker.press("Shift+ArrowRight");
  expect(await page.locator(".sticker-node").getAttribute("style")).not.toEqual(
    before,
  );
  await sticker.press("+");
  await expect(
    page.getByRole("slider", { name: "Sticker size", exact: true }),
  ).toHaveValue("68");
  await page
    .getByRole("slider", { name: "Sticker size", exact: true })
    .fill("120");
  await expect(sticker).toHaveCSS("width", "120px");
  await sticker.press("Delete");
  await expect(sticker).toHaveCount(0);
  for (let i = 0; i < 24; i++)
    await page
      .getByRole("button", { name: "Add 🌙 sticker", exact: true })
      .click();
  await expect(sticker).toHaveCount(24);
  await expect(
    page.getByRole("button", { name: "Add 🌙 sticker", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Remove selected sticker", exact: true })
    .click();
  await expect(sticker).toHaveCount(23);
  await expect(
    page.getByRole("button", { name: "Add 🌙 sticker", exact: true }),
  ).toBeEnabled();
});

test("older drafts retain their stickers and become editable", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "leap-draft-writing",
      JSON.stringify({
        title: "Older draft",
        text: "An older entry.",
        date: "2026-10-01",
        mood: null,
        prompt: "",
        decoration: {
          font: "serif",
          paper: "mint",
          highlight: "none",
          note: "",
          stickers: ["🌼", "🌼", "🌿"],
        },
      }),
    ),
  );
  await page
    .getByRole("button", { name: "Write an entry", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "🌼 sticker", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "🌼 sticker", exact: true })
    .first()
    .press("Delete");
  await expect(
    page.getByRole("button", { name: "🌼 sticker", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "🌿 sticker", exact: true }),
  ).toHaveCount(1);
});

test.describe("touch stickers", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("dragging and resizing works on mobile and stays inside the paper", async ({
    page,
  }) => {
    await start(page);
    await page
      .getByRole("button", { name: "Add 🌼 sticker", exact: true })
      .tap();
    const sticker = page.getByRole("button", {
      name: "🌼 sticker",
      exact: true,
    });
    const cdp = await page.context().newCDPSession(page);
    async function touchDrag(target: Locator, dx: number, dy: number) {
      await target.scrollIntoViewIfNeeded();
      const b = (await target.boundingBox())!;
      const x = b.x + b.width / 2,
        y = b.y + b.height / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 8; step++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * step) / 8, y: y + (dy * step) / 8 }],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await sticker.scrollIntoViewIfNeeded();
    const before = (await sticker.boundingBox())!;
    await touchDrag(sticker, 90, -120);
    const after = (await sticker.boundingBox())!;
    expect(after.x - before.x).toBeCloseTo(90, 0);
    expect(after.y - before.y).toBeCloseTo(-120, 0);
    await touchDrag(
      page.getByRole("button", { name: "Resize 🌼 sticker", exact: true }),
      40,
      40,
    );
    await expect(
      page.getByRole("slider", { name: "Sticker size", exact: true }),
    ).toHaveValue("104");
    await touchDrag(sticker, -500, -700);
    const edge = (await sticker.boundingBox())!;
    const paper = (await page.locator(".journal-paper").boundingBox())!;
    expect(edge.x).toBeGreaterThanOrEqual(paper.x);
    expect(edge.y).toBeGreaterThanOrEqual(paper.y);
    await page
      .getByRole("textbox", { name: "Journal entry", exact: true })
      .fill("I can still write around my stickers.");
    await expect(
      page.getByRole("textbox", { name: "Journal entry", exact: true }),
    ).toHaveValue("I can still write around my stickers.");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: "/tmp/leap-stickers-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    await cdp.detach();
  });
});
