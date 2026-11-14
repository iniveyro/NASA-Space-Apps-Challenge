import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const isCI = Boolean(process.env.CI);

/**
 * E2E runs against a production build (`next start`).
 * Locally the installed Google Chrome is used (no browser download needed);
 * CI installs Playwright's Chromium (`npx playwright install --with-deps chromium`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(isCI || process.env.PW_BUNDLED_CHROMIUM ? {} : { channel: "chrome" }) },
    },
  ],
  webServer: {
    command: isCI ? `npm run start -- --port ${PORT}` : `npm run build && npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 240_000,
  },
});
