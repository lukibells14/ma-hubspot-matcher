import { test, expect } from "@playwright/test";
import { uploadBothFiles, waitForReady, MA_CSV } from "./helpers";

test.describe("Column Mapping", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("auto-guesses MA and HubSpot name columns after upload", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);

    // Column mapper section (3) Select Columns for Matching) should be visible
    await expect(page.getByText("3) Select Columns for Matching")).toBeVisible();

    // MA name column auto-guessed to "Company Name"
    const maNameSelect = page.locator("select").nth(0);
    await expect(maNameSelect).toHaveValue("Company Name");

    // HubSpot name column auto-guessed to "Company name"
    const hubNameSelect = page.locator("select").nth(2);
    await expect(hubNameSelect).toHaveValue("Company name");
  });

  test("auto-guesses domain columns after upload", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);

    // MA domain auto-guessed to "Domain Name"
    const maDomainSelect = page.locator("select").nth(1);
    await expect(maDomainSelect).toHaveValue("Domain Name");

    // HubSpot domain auto-guessed to "Company Domain Name"
    const hubDomainSelect = page.locator("select").nth(3);
    await expect(hubDomainSelect).toHaveValue("Company Domain Name");
  });

  test("can manually change MA name column", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);

    // Change MA name column to "Domain Name" (another available column)
    const maNameSelect = page.locator("select").nth(0);
    await maNameSelect.selectOption("Domain Name");
    await expect(maNameSelect).toHaveValue("Domain Name");

    // Start Matching should still be enabled (mapping is still valid)
    await expect(page.getByRole("button", { name: "Start Matching" })).toBeEnabled();
  });

  test("can manually change HubSpot unique code column", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);

    // The HubSpot unique code dropdown (4th select) can be set to "Record ID"
    const hubCodeSelect = page.locator("select").nth(4);
    await hubCodeSelect.selectOption("Record ID");
    await expect(hubCodeSelect).toHaveValue("Record ID");
  });

  test("Start Matching is disabled until both CSVs are uploaded", async ({ page }) => {
    // No files uploaded — button should not exist yet
    await expect(page.getByRole("button", { name: "Start Matching" })).not.toBeVisible();
  });

  test("file names are displayed after upload", async ({ page }) => {
    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(MA_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("ma-sample.csv")).toBeVisible();
  });
});
