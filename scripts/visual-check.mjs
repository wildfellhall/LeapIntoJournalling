import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  await page.goto("http://127.0.0.1:5173");
  await page
    .getByRole("heading", { name: "A little space. A lot of you." })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "/tmp/leap-home.png", fullPage: true });
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await mobile.goto("http://127.0.0.1:5173");
  await mobile
    .getByRole("heading", { name: "A little space. A lot of you." })
    .waitFor();
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: "/tmp/leap-mobile.png", fullPage: true });
  await mobile.close();
  await page
    .getByRole("button", { name: "Explore a sample journal", exact: true })
    .click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page.screenshot({ path: "/tmp/leap-connections.png", fullPage: true });
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.screenshot({ path: "/tmp/leap-insights.png", fullPage: true });
  console.log(
    "Visual captures saved to /tmp/leap-{home,mobile,connections,insights}.png",
  );
} finally {
  await browser.close();
}
