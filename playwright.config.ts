import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real Next.js production build in Demo Mode.
 *   npm run test:e2e
 * CHROME_PATH lets the suite use an installed Chrome instead of Playwright's download.
 */
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", launchOptions: { executablePath } },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Demo Mode: no Firebase config is passed to the test build.
    env: { NEXT_PUBLIC_FIREBASE_API_KEY: "", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "", NEXT_PUBLIC_FIREBASE_APP_ID: "" },
  },
});
