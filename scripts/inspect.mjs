import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:3001");
await page.locator("main h1").waitFor();
console.log(
  "Page widths",
  await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  })),
);
await page.setViewportSize({ width: 1440, height: 1000 });
const audit = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
  .analyze();
console.log(
  "Accessibility",
  JSON.stringify(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    null,
    2,
  ),
);
await browser.close();
