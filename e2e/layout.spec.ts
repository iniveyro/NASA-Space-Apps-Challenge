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
