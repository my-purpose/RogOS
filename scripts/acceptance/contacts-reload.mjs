// Run against a local dev server. Uses isolated browser storage, not user data.
// CHROME_PATH may point to an installed Chrome; otherwise use Playwright Chromium.
import { chromium } from "playwright";
const base = process.env.ACCEPTANCE_URL || "http://127.0.0.1:5174";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) {
  throw new Error("Acceptance tests must target a local server");
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const results = [];
try {
  for (const delay of [0, 0, 0, 0, 0, 1000]) {
    const context = await browser.newContext({ locale: "en-US" });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto(base);
      // Use the app-manager entry point; editing itself uses the actual UI.
      await page.evaluate(async () => {
        const { useAppStore } = await import("/src/stores/useAppStore.ts");
        useAppStore.getState().launchApp("contacts");
      });
      await page.getByTitle("New Contact", { exact: true }).click();
      await page.getByPlaceholder("First Name", { exact: true }).fill("Acceptance");
      await page.getByPlaceholder("Last Name", { exact: true }).fill("Reload");
      await page.getByRole("button", { name: "Done", exact: true }).click();
      if (delay) await page.waitForTimeout(delay);
      await page.reload();
      await page.getByTitle("New Contact", { exact: true }).waitFor();
      await page.waitForTimeout(500);
      const retained = await page.getByText("Acceptance Reload", { exact: true }).count() > 0;
      results.push({ waitBeforeReloadMs: delay, retained });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify(results, null, 2));
// Any observed loss makes the run fail; a passing run does not disprove a timing race.
if (results.some(result => !result.retained)) process.exitCode = 1;
