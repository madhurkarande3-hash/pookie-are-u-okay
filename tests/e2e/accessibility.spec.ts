import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loadSample } from "./helpers";

const PAGES = ["/home", "/companion", "/checkin", "/medications", "/appointments", "/lifebook", "/circle", "/settings", "/privacy"];

for (const theme of ["sweet", "cool"] as const) {
  test(`no serious accessibility problems (${theme} theme)`, async ({ page }) => {
    await loadSample(page);
    await page.evaluate((pookie) => {
      const prefs = JSON.parse(localStorage.getItem("pookie.prefs.v1") ?? "{}");
      localStorage.setItem("pookie.prefs.v1", JSON.stringify({ ...prefs, pookie }));
    }, theme);
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${path}: ${v.id} — ${v.nodes.length} node(s)`)).toEqual([]);
    }
  });
}

test("keyboard: skip link moves focus to the main content", async ({ page }) => {
  await loadSample(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Skip to/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});
