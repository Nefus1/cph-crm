import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a throwaway local Postgres database with the dev auth bypass.
 * Set E2E_DATABASE_URL (defaults to a local cph_test database).
 */
const PORT = 3100;
const DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/cph_test";
const env = {
  DATABASE_URL: DB,
  DEV_AUTH_BYPASS: "true",
  DEV_AUTH_EMAIL: "e2e-admin@example.com",
  BOOTSTRAP_ADMIN_EMAIL: "e2e-admin@example.com",
  ENCRYPTION_KEY: "1".repeat(64),
  APP_URL: `http://localhost:${PORT}`,
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } }],
  webServer: {
    // Fresh schema + demo data, then the app.
    command: `npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts --reset && ${process.env.E2E_USE_BUILD ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env,
  },
});
