import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3101",
    headless: true,
    channel: process.env.PW_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node --import tsx server/index.ts",
    url: "http://127.0.0.1:3101/api/health",
    timeout: 30000,
    reuseExistingServer: false,
    env: {
      PORT: "3101",
      HOST: "127.0.0.1",
      DATA_DIR: join(tmpdir(), `claimchain-browser-${Date.now()}`),
      SEED_SAMPLE: "true",
      AUTH_EXPOSE_CODES: "true",
      SIMULATION_ENABLED: "false",
    },
  },
});
