import { expect, test } from "@playwright/test";
import { loadSample, onboard } from "./helpers";

test("onboarding: separate look and companion, consent off by default", async ({ page }) => {
  await page.goto("/onboarding/pookie");
  await page.getByText("Cool Pookie").click();
  await page.getByText("Kaka Pookie").click();
  await expect(page.locator("html")).toHaveAttribute("data-pookie", "cool");
  await page.getByRole("link", { name: "Next" }).click();
  await page.getByLabel("Your full name").fill("Ramesh Kulkarni");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("link", { name: "Continue" }).click();
  for (const toggle of await page.getByRole("switch").all()) await expect(toggle).toHaveAttribute("aria-checked", "false");
});

test("medicines: a passed dose is 'Not confirmed', never 'missed', until the elder answers", async ({ page }) => {
  await onboard(page);
  await page.goto("/medications");
  await page.getByRole("button", { name: "Add a medicine" }).click();
  await page.getByLabel("Name").fill("Amlodipine");
  await page.getByLabel("Time 1").fill("00:01");
  await page.getByRole("button", { name: "Save" }).click();
  const dose = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "I took it" }) });
  await expect(dose.getByText("Not confirmed")).toBeVisible();
  await expect(page.getByText("Missed", { exact: true })).toHaveCount(0);
  await dose.getByRole("button", { name: "I took it" }).click();
  await expect(page.getByText("Taken", { exact: true }).first()).toBeVisible();
});

test("companion: never guesses about someone not in the LifeBook", async ({ page }) => {
  await onboard(page);
  await page.goto("/companion");
  await page.getByRole("button", { name: "Start talking" }).click();
  await page.getByLabel("Or type your message").fill("Who is my daughter?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("log")).toContainText("won't guess");
  await expect(page.getByRole("log")).toContainText("pre-written, not AI");
});

test("language switch keeps the theme and translates the app", async ({ page }) => {
  await loadSample(page);
  const theme = await page.locator("html").getAttribute("data-pookie");
  await page.getByRole("button", { name: "हिन्दी" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.locator("html")).toHaveAttribute("data-pookie", theme ?? "sweet");
  await expect(page.getByText("आज", { exact: true })).toBeVisible();
});

test("family member sees only what was granted, and pausing sharing hides everything", async ({ page }) => {
  await loadSample(page);
  await page.goto("/circle");
  await page.getByRole("button", { name: "See the app as Ravi" }).click();
  await expect(page).toHaveURL(/\/family/);
  await expect(page.getByText("Medicines today")).toBeVisible();
  await expect(page.getByText("Shared check-ins")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to elder view" }).click();
  await page.goto("/circle");
  await page.getByRole("switch", { name: /Pause all sharing/ }).click();
  await page.getByRole("button", { name: "See the app as Ravi" }).click();
  await expect(page.getByText("Medicines today")).toHaveCount(0);
});

test("help: only the elder asks, and the helper can reply", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("button", { name: "I'd like some help" }).click();
  await page.getByLabel(/Anything you want to say/).fill("Can someone call me?");
  await page.getByRole("button", { name: "Send to Apne Log" }).click();
  await expect(page.getByText("Sent — waiting for a reply")).toBeVisible();
  await page.goto("/circle");
  await page.getByRole("button", { name: "See the app as Priya" }).click();
  await expect(page.getByText("Can someone call me?")).toBeVisible();
  await page.getByRole("button", { name: "I'm on it" }).click();
  await expect(page.getByText("Priya saw it and is on it")).toBeVisible();
});

test("LifeBook: family suggestions wait for approval; conflicts are flagged, not guessed", async ({ page }) => {
  await loadSample(page);
  await page.goto("/lifebook");
  await expect(page.getByText("Suggested by Apne Log")).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Name").fill("Priya");
  await page.getByLabel("How are they related to you?").fill("niece");
  await page.getByLabel("Details").fill("A second note that disagrees");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Two notes disagree")).toBeVisible();
});

test("schedules: a family proposal does nothing until the elder accepts it", async ({ page }) => {
  await loadSample(page);
  await expect(page.getByText("1 suggested check-in time(s) are waiting for your answer.")).toBeVisible();
  await page.goto("/circle");
  const proposal = page.getByRole("listitem").filter({ hasText: "Video call with Priya" });
  await expect(proposal.getByText("Waiting for answer")).toBeVisible();
  await proposal.getByRole("button", { name: "Yes, accept" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Video call with Priya" }).getByText("On", { exact: true })).toBeVisible();
});

test("care team: demo admin login shows the patient table", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email address").fill("care@demo.pookie");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email or password didn't work.")).toBeVisible();
  await page.getByLabel("Password").fill("demo-care-team");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("rowheader", { name: /Asha/ })).toBeVisible();
});

test("health and emergency: hand-entered hospital, 112 and no automatic calls", async ({ page }) => {
  await loadSample(page);
  await page.goto("/health");
  await expect(page.getByText("Entered by hand").first()).toBeVisible();
  await page.goto("/emergency");
  await expect(page.getByRole("link", { name: /Call 112/ })).toHaveAttribute("href", "tel:112");
  await expect(page.getByText("Pookie never calls anyone by itself", { exact: false })).toBeVisible();
});

test("where am I: same calm answer, from approved data", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("button", { name: "Where am I? What's today?" }).click();
  await expect(page.getByText("You are Asha.")).toBeVisible();
});
