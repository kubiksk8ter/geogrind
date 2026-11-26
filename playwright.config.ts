import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Smoke tests drive the production build in a real browser. The AI and the geocoder are never
// called (the tests answer /api/command themselves), so the values below are placeholders.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The map needs WebGL; software rendering makes it work on machines without a GPU.
        launchOptions: {
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      GROQ_API_KEY: "smoke-test-key",
      GEOCODER_CONTACT: "smoke-test@example.invalid",
      CLIENT_IP_HEADER: "x-real-ip",
      APP_ORIGIN: BASE_URL,
      STATE_DIR: ".data-smoke",
    },
  },
});
