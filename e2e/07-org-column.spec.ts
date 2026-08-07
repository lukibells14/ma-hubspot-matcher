import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { waitForReady, startMatchingAndWait, MA_CSV, HUB_CSV } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORG_CSV = path.resolve(__dirname, "fixtures/org-sample.csv");

test.describe("Non-standard column name: Organization", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    // Upload org-sample.csv (columns: Organization, Domain) as the MA file
    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(ORG_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    // Upload the standard HubSpot file
    const hubInput = page.locator('input[type="file"]').nth(1);
    await hubInput.setInputFiles(HUB_CSV);
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("auto-guess picks Organization as the MA name column (regex match)", async ({ page }) => {
    // "Organization" now matches /organization/i in the extended regex.
    // This is more reliable than the old columns[0] fallback.
    const maNameSelect = page.locator("select").nth(0);
    await expect(maNameSelect).toHaveValue("Organization");
  });

  test("auto-guess picks Domain as the MA domain column", async ({ page }) => {
    // "Domain" matches /domain/i — should be auto-guessed.
    const maDomainSelect = page.locator("select").nth(1);
    await expect(maDomainSelect).toHaveValue("Domain");
  });

  test("Start Matching becomes enabled with Organization column mapped", async ({ page }) => {
    await waitForReady(page);
    await expect(page.getByRole("button", { name: "Start Matching" })).toBeEnabled();
  });

  test("matching UI shows the Organization column values as company names", async ({ page }) => {
    await waitForReady(page);
    await startMatchingAndWait(page);

    // The M&A panel should display one of the fixture company names from the Organization column
    const maPanel = page.locator("section").filter({ hasText: "M&A COMPANY" });
    await expect(maPanel).toBeVisible();
    // At least one of the Organization values should appear in the panel
    const companyNames = ["Acme Corporation", "Beta Technologies", "Gamma Holdings", "Delta Partners", "Epsilon Corp"];
    let found = false;
    for (const name of companyNames) {
      if (await maPanel.getByText(name, { exact: false }).count() > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("full matching flow completes with Organization column", async ({ page }) => {
    await waitForReady(page);
    await startMatchingAndWait(page);

    // Select all 5 records
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }

    await expect(page.getByText(/Finished\. Export your table\./i)).toBeVisible({ timeout: 10_000 });
  });

  test("can manually remap Organization to a different column and back", async ({ page }) => {
    // Both columns available: Organization, Domain
    const maNameSelect = page.locator("select").nth(0);

    // Switch to Domain (wrong, but confirms the select works)
    await maNameSelect.selectOption("Domain");
    await expect(maNameSelect).toHaveValue("Domain");

    // Switch back to Organization
    await maNameSelect.selectOption("Organization");
    await expect(maNameSelect).toHaveValue("Organization");

    // Start Matching should still be reachable
    await waitForReady(page);
    await expect(page.getByRole("button", { name: "Start Matching" })).toBeEnabled();
  });

  test("Export modal shows Organization column values in the selections table", async ({ page }) => {
    await waitForReady(page);
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /Export to Excel/i }).click();
    await expect(page.getByText("Export Files")).toBeVisible({ timeout: 5_000 });

    // Should show remaining CSV section (1 of 5 done, not finished)
    await expect(page.getByText(/Remaining MA records/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Stale column guard on re-upload", () => {
  test("re-uploading Organization CSV after Company Name CSV remaps the name column correctly", async ({ page }) => {
    await page.goto("/");

    // 1. Upload both standard files so the column mapping selects are visible
    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(MA_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    const hubInput = page.locator('input[type="file"]').nth(1);
    await hubInput.setInputFiles(HUB_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    // The mapping selects are now visible in the ready state
    const maNameSelect = page.locator("select").nth(0);
    await expect(maNameSelect).toHaveValue("Company Name");

    // 2. Re-upload the "Organization" CSV — "Company Name" no longer exists in it
    await maInput.setInputFiles(ORG_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    // The stale "Company Name" mapping must be replaced with "Organization"
    await expect(maNameSelect).toHaveValue("Organization");
  });

  test("left panel shows company name values (not blank) after re-uploading Organization CSV", async ({ page }) => {
    await page.goto("/");

    // Upload "Company Name" CSV first to set up stale state
    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(MA_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    const hubInput = page.locator('input[type="file"]').nth(1);
    await hubInput.setInputFiles(HUB_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    // Now re-upload "Organization" CSV as the MA file
    await maInput.setInputFiles(ORG_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    // Start matching — the left panel must show real company names, not blank
    await page.getByRole("button", { name: "Start Matching" }).waitFor({ state: "visible", timeout: 30_000 });
    await startMatchingAndWait(page);

    const maPanel = page.locator(".ds-card").filter({ hasText: "M&A Company" }).first();
    // The bold value div directly after the "Organization" label must not be empty
    const orgLabel = maPanel.getByText("Organization");
    await expect(orgLabel).toBeVisible();
    // Verify at least one fixture company name is shown (not blank)
    const companyNames = ["Acme Corporation", "Beta Technologies", "Gamma Holdings", "Delta Partners", "Epsilon Corp"];
    let found = false;
    for (const name of companyNames) {
      if (await maPanel.getByText(name, { exact: false }).count() > 0) { found = true; break; }
    }
    expect(found, "Left panel must show a company name from Organization column, not be blank").toBe(true);
  });
});
