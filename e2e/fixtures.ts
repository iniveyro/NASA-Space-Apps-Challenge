import { test as base, expect, type Page } from "@playwright/test";

/** Fails any test that logs a browser error or throws an uncaught exception. */
export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "browser errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** True when this browser can create a WebGL context; 3D views fall back to 2D when it cannot. */
export async function supportsWebgl(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) !== null;
  });
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
