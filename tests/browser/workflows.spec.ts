import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";

async function login(page: Page, identifier = "admin") {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(identifier);
  await page
    .getByLabel("Password", { exact: true })
    .fill("ClaimChainDemo!2026");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(page.getByText("Opening your workspace...")).toBeVisible();
  await expect(page.locator(".workspace-loader")).toHaveCount(1);
  await expect(page.locator(".workspace-loader > span")).toHaveCount(1);
  await expect(page).toHaveURL(/\/workspace$/);
}

test("login handoff is legible and route motion reverses with history", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("admin");
  await page
    .getByLabel("Password", { exact: true })
    .fill("ClaimChainDemo!2026");

  const started = Date.now();
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(page.getByText("Opening your workspace...")).toBeVisible();
  mkdirSync(".impeccable/review", { recursive: true });
  await page.screenshot({
    path: ".impeccable/review/loading.png",
    fullPage: false,
  });
  await page.waitForTimeout(600);
  await expect(page.getByText("Opening your workspace...")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your recovery workspace" }),
  ).toBeVisible();
  expect(Date.now() - started).toBeGreaterThanOrEqual(1100);

  await page.getByRole("link", { name: /Recovery cases/ }).click();
  await expect(page.locator(".route-transition-workspace")).toHaveAttribute(
    "data-direction",
    "forward",
  );
  await expect(
    page.getByRole("heading", { name: "Recovery cases" }),
  ).toBeVisible();
  await expect(page.locator(".route-transition-workspace")).toHaveAttribute(
    "data-phase",
    "idle",
  );

  await page.goBack();
  await expect(page.locator(".route-transition-workspace")).toHaveAttribute(
    "data-direction",
    "backward",
  );
  await expect(
    page.getByRole("heading", { name: "Your recovery workspace" }),
  ).toBeVisible();
  await expect(page.locator(".route-transition-workspace")).toHaveAttribute(
    "data-phase",
    "idle",
  );
});

test("top-bar ingestion control persists and governs manual ingestion", async ({
  page,
}) => {
  await login(page);
  await expect(
    page.getByRole("button", { name: "Continue", pressed: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Halt" }).click();
  await expect(
    page.getByRole("button", { name: "Halt", pressed: true }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your recovery workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Halt", pressed: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Access control" }).click();
  await page.getByRole("button", { name: "Data ingestion" }).click();
  await expect(page.getByText("Ingestion is halted")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ingestion halted" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("button", { name: "Continue", pressed: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ingest next event" }),
  ).toBeEnabled();
});

test("landing page fills the viewport without clipping", async ({ page }) => {
  mkdirSync(".impeccable/review", { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Turn scattered proof/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open ClaimChain" }),
  ).toBeVisible();
  await expect(page.locator(".landing-art")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1800);
  expect(
    await page.evaluate(() => ({
      width: document.documentElement.scrollWidth === window.innerWidth,
      height: document.documentElement.scrollHeight === window.innerHeight,
      background: getComputedStyle(document.querySelector(".landing")!)
        .backgroundColor,
    })),
  ).toEqual({ width: true, height: true, background: "rgb(0, 0, 0)" });
  await page.screenshot({
    path: ".impeccable/review/landing-1280x800.png",
    fullPage: true,
  });
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(1800);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".impeccable/review/landing-mobile.png",
    fullPage: true,
  });
});

test("authentication screen is responsive and supports password recovery", async ({
  page,
}) => {
  const expectAuthPageToCoverViewport = async () => {
    const bounds = await page.locator(".auth-page").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const visualRect = element
        .querySelector(".auth-visual")!
        .getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        height: rect.height,
        visualTop: visualRect.top,
        visualLeft: visualRect.left,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });

    expect(bounds.top).toBe(0);
    expect(bounds.left).toBe(0);
    expect(bounds.right).toBe(bounds.viewportWidth);
    expect(bounds.height).toBeGreaterThanOrEqual(bounds.viewportHeight);
    expect(bounds.visualTop).toBe(0);
    expect(bounds.visualLeft).toBe(0);
  };

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.locator(".auth-visual video")).toBeVisible();
  await expectAuthPageToCoverViewport();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByLabel("Email or username").fill("admin");
  await page.getByRole("button", { name: "Send reset code" }).click();
  await expect(page).toHaveURL(/\/reset-password/);
  await expect(page.getByText("LOCAL DEVELOPMENT CODE")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.locator(".auth-mobile-brand")).toBeVisible();
  await expectAuthPageToCoverViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === window.innerWidth,
    ),
  ).toBe(true);
});

test("mobile navigation keeps hidden links out of focus and restores its trigger", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("#workspace-navigation")).toHaveAttribute(
    "inert",
    "",
  );
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".sidebar .brand")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("link", { name: "Access control" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".sidebar .brand")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator("#workspace-navigation")).toHaveAttribute(
    "inert",
    "",
  );
});

test("unsaved correspondence survives Escape and can be explicitly discarded", async ({
  page,
}) => {
  await login(page);
  await page.goto("/cases/case-2");
  await page.getByRole("button", { name: /Prepare a reminder/ }).click();
  const editor = page.getByLabel("Letter content");
  await editor.fill("An unsaved owner edit.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("This draft has unsaved changes.")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(editor).toHaveValue("An unsaved owner edit.");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("payment case: create, attach evidence, prepare a letter, record payment and export", async ({
  page,
}) => {
  await login(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Your recovery workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New case", exact: true }).click();
  await page
    .getByLabel("Case title", { exact: true })
    .fill("Browser workflow invoice");
  await page.getByLabel("Customer / counterparty").fill("Browser Test Cafe");
  await page.getByLabel("Invoice amount (INR)").fill("1234.50");
  await page.getByLabel("Invoice number").fill("BROWSER-001");
  await page
    .getByLabel("Case notes")
    .fill("Delivered provisions. Fictional browser test.");
  await page.getByRole("button", { name: "Create case", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser workflow invoice" }),
  ).toBeVisible();
  const caseUrl = page.url();
  await page.getByLabel("Upload evidence file").setInputFiles({
    name: "browser-proof.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Fictional invoice BROWSER-001. INR 1234.50."),
  });
  await expect(
    page.getByRole("button", { name: /browser-proof.txt/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Prepare a reminder/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Letter content")).toContainText(
    "Browser Test Cafe",
  );
  await page
    .getByLabel("Letter content")
    .fill(
      (await page.getByLabel("Letter content").inputValue()) +
        "\nReviewed by the owner.",
    );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Download PDF" }),
  ).not.toHaveAttribute("aria-disabled", "true");
  const letterDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  expect((await letterDownload).suggestedFilename()).toBe(
    "claimchain-letter.pdf",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByLabel("Amount received (INR)").fill("234.50");
  await page.getByLabel("Transaction reference").fill("BROWSER-UTR-001");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.locator(".balance-amount")).toHaveText("₹1,000");
  await page.reload();
  await expect(page.locator(".balance-amount")).toHaveText("₹1,000");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByLabel("Transaction reference").fill("BROWSER-UTR-002");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Payment complete" }),
  ).toBeDisabled();
  const packetDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export packet" }).click();
  expect((await packetDownload).suggestedFilename()).toMatch(
    /CC-\d+-case-packet.pdf/,
  );
  await page.goto("/cases");
  await page
    .getByRole("textbox", { name: "Search cases" })
    .fill("Browser Test Cafe");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto(caseUrl);
  await expect(page.locator(".balance-amount")).toHaveText("₹0");
  expect(errors).toEqual([]);
});

test("stock handoff reserves, dispatches, receives and changes available quantity", async ({
  page,
}) => {
  await login(page);
  await page.goto("/stock");
  const rice = page
    .locator(".inventory-item")
    .filter({ hasText: "Sona masoori rice" });
  await rice.getByRole("button", { name: "Transfer stock" }).click();
  await page.getByLabel("Quantity (bags)").fill("10");
  await page.getByRole("button", { name: "Reserve stock" }).click();
  await expect(
    page.getByText("Units reserved at the source store."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark dispatched" }).click();
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(
    page.getByText("Receipt confirmed. Both inventories updated."),
  ).toBeVisible();
  await page.getByRole("button", { name: /Available inventory/ }).click();
  await page
    .getByRole("textbox", { name: "Search inventory" })
    .fill("Sona masoori rice");
  const lots = page
    .locator(".inventory-item")
    .filter({ hasText: "Sona masoori rice" });
  await expect(lots).toHaveCount(2);
  await expect(
    lots
      .filter({ hasText: "Mehta General Stores" })
      .locator(".inventory-numbers")
      .first(),
  ).toContainText("54");
  await expect(
    lots
      .filter({ hasText: "Green Basket" })
      .locator(".inventory-numbers")
      .first(),
  ).toContainText("10");
});

test("document recovery checklist and follow-up flow", async ({ page }) => {
  await login(page);
  await page.goto("/cases/case-4");
  await expect(
    page.getByRole("button", { name: "Resolve case", exact: true }),
  ).toBeDisabled();
  for (const label of [
    "Identity or business proof",
    "Supporting records collected",
    "Request reviewed",
    "Replacement or resolution confirmed",
  ])
    await page.getByLabel(label).check();
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reopen case" })).toBeVisible();
  await page.getByRole("button", { name: /Schedule a follow-up/ }).click();
  await page
    .getByLabel("Follow-up", { exact: true })
    .fill("Collect replacement certificate");
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete Collect replacement certificate" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Reopen Collect replacement certificate",
    }),
  ).toBeVisible();
});

test("desktop and mobile layouts, navigation, accessibility and screenshots", async ({
  page,
}) => {
  await login(page);
  mkdirSync(".impeccable/review", { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/workspace");
    await expect(
      page.getByRole("heading", { name: "Your recovery workspace" }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `.impeccable/review/${name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (name === "mobile") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Stock exchange" })
        .click();
      await expect(
        page.getByRole("heading", { name: "Stock exchange", exact: true }),
      ).toBeVisible();
    }
    for (const path of [
      "/cases",
      "/cases/case-1",
      "/stock",
      "/tasks",
      "/settings",
    ]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${name} overflow on ${path}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/cases/case-1");
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/case-desktop.png",
    fullPage: true,
  });
  await page.goto("/stock");
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({
    path: ".impeccable/review/stock-desktop.png",
    fullPage: true,
  });
  await page.goto("/workspace");
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test("short desktop sidebars keep navigation reachable and settings in the account menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 414 });
  await login(page);
  const sidebar = page.locator("#workspace-navigation");
  await expect(sidebar).toHaveCSS("overflow-y", "auto");
  await expect(sidebar.locator(".profile")).toHaveCount(0);
  await expect(page.locator(".topbar-profile")).toContainText("Aarav Mehta");
  await expect(sidebar.getByText("Sample workspace")).toHaveCount(0);
  await expect(sidebar.getByText("About this workspace")).toHaveCount(0);
  await expect(sidebar.getByText("Settings", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open account menu for Aarav Mehta" })
    .click();
  await expect(page.getByRole("menuitem", { name: "Settings" })).toBeFocused();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await sidebar.evaluate((element) =>
    element.scrollTo(0, element.scrollHeight),
  );
  await page.screenshot({
    path: ".impeccable/review/sidebar-short.png",
    fullPage: false,
  });
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Workspace settings" }),
  ).toBeVisible();
});
