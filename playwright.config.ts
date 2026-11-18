import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:43123",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:43123",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testMatch: "reader.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "laptop",
      testMatch: "flows.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "phone",
      testMatch: "flows.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
