const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "tests/ui",
  timeout: 30000,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: ".tools/test-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3211",
    viewport: { width: 1920, height: 1080 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: ".tools/test-results",
  webServer: {
    command: "node scripts/preview.cjs",
    url: "http://127.0.0.1:3211",
    reuseExistingServer: true,
    timeout: 15000,
  },
});
