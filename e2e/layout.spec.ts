import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

const WIDTHS = [320, 390, 768, 1024, 1440, 1920];

test.describe("responsive layout", () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator(".crew-card")).toHaveCount(4);
      await expectNoHorizontalOverflow(page);
      await page.goto("/astronaut/sofia");
      await expect(page.locator(".metric-card")).toHaveCount(10);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("shows the ASTRO Health logo and UMBRAL wordmark without header metadata", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const header = page.locator("header");
    const homeLink = header.getByRole("link", { name: "ASTRO Health home" });
    await expect(homeLink).toHaveAttribute("href", "/");
    await expect(header.getByText("ASTRO Health", { exact: true })).toBeVisible();
    await expect(header.getByText("Mission wellness console", { exact: true })).toHaveCount(0);
    await expect(header.getByText("UMBRAL", { exact: true })).toBeVisible();
    await expect(header.locator("svg[data-brand-symbol]")).toHaveAttribute("viewBox", "0 0 48 48");
    expect(await header.locator("svg[data-brand-symbol]").evaluate((icon) => icon.getBoundingClientRect().width)).toBe(48);
    await expect(header).not.toContainText(/SIMULATED DATA|FICTIONAL|ENVIRONMENT|MICROGRAVITY|MISSION DAY/i);
    await expect(page.locator("footer")).toContainText("ASTRO HEALTH · MISSION WELLNESS CONSOLE");
    await header.screenshot({ path: testInfo.outputPath("astro-branding-desktop.png") });

    await page.setViewportSize({ width: 320, height: 900 });
    await expectNoHorizontalOverflow(page);
    await expect(homeLink).toBeVisible();
    await expect(header.getByText("UMBRAL", { exact: true })).toBeVisible();
    await header.screenshot({ path: testInfo.outputPath("astro-branding-mobile.png") });
  });

  test("uses design tokens for the canvas and light gray crew cards", async ({ page }) => {
    await page.goto("/");
    const colors = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      card: getComputedStyle(document.querySelector(".crew-card")!).backgroundColor,
      cardLink: getComputedStyle(document.querySelector(".crew-card-action")!).backgroundColor,
    }));
    expect(colors).toEqual({
      body: "rgb(245, 247, 250)",
      card: "rgb(238, 241, 245)",
      cardLink: "rgb(238, 241, 245)",
    });
  });

  test("honors reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const behavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(behavior).toBe("auto");
  });
});
