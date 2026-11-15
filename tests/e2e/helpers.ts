import { expect, type Page } from "@playwright/test";

/** Completes onboarding as a fresh elder in Demo Mode. */
export async function onboard(page: Page, name = "Sunita"): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByRole("link", { name: "Next" }).click();
  await page.getByLabel("Your full name").fill(`${name} Deshpande`);
  await page.getByLabel("What should Pookie call you?").fill(name);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("link", { name: "Continue" }).click();
  for (const toggle of await page.getByRole("switch").all()) await toggle.click();
  await page.getByRole("button", { name: "Finish and open Pookie" }).click();
  await expect(page).toHaveURL(/\/home/);
}

/** Loads the fictional sample person (Asha) and her Care Circle. */
export async function loadSample(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Asha");
}
