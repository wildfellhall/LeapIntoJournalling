import { test, expect } from "@playwright/test";
test("optional camera loads local models and ends capture before saving", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const loaded: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/models/") && r.status() === 200)
      loaded.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Let’s make a little room" }).click();
  await page.getByLabel("Expression tracking", { exact: true }).check();
  await page
    .getByRole("button", { name: "Enable camera", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop camera", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".capture-status")).toContainText(
    /Looking for your face|Expression estimates active/,
    { timeout: 30000 },
  );
  const count = Number(
    (await page.locator(".capture-status").innerText()).match(
      /(\d+) samples/,
    )?.[1] || 0,
  );
  expect(loaded.some((p) => p.includes("blazeface.bin"))).toBe(true);
  expect(loaded.some((p) => p.includes("emotion.bin"))).toBe(true);
  await expect(
    page.getByRole("button", { name: "Complete entry", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect(page.locator(".capture-status")).toContainText("Camera off");
  expect(
    await page
      .getByLabel("Expression tracking preview")
      .evaluate((el: HTMLVideoElement) =>
        (el.srcObject as MediaStream)
          .getTracks()
          .every((t) => t.readyState === "ended"),
      ),
  ).toBe(true);
  await page
    .getByRole("textbox", { name: "Journal entry", exact: true })
    .fill("I feel peaceful.");
  await page
    .getByRole("button", { name: "Complete entry", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A little piece of today", exact: true })
    .click();
  await page.getByText("Explore this entry’s signals", { exact: true }).click();
  await expect(page.locator(".analysis-details")).toContainText(
    count
      ? `${count} expression samples`
      : "No facial-expression samples collected.",
  );
  expect(errors).toEqual([]);
});
