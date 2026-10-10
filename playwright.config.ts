import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1100 },
    launchOptions: {
      channel: "chrome",
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
    permissions: ["camera", "microphone"],
  },
  reporter: "list",
});
