import { test, expect } from "@playwright/test";
import { uploadBothFiles, waitForReady } from "./helpers";

test.describe("Batch Options", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await uploadBothFiles(page);
    await waitForReady(page);
  });

  test("batch option checkboxes are visible and unchecked by default", async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    // There are 3 batch option checkboxes
    await expect(checkboxes.nth(0)).not.toBeChecked();
    await expect(checkboxes.nth(1)).not.toBeChecked();
    await expect(checkboxes.nth(2)).not.toBeChecked();
  });

  test("checking Auto-match exact names shows a match count badge", async ({ page }) => {
    const exactCheckbox = page.locator('input[type="checkbox"]').nth(0);
    await exactCheckbox.check();
    await expect(exactCheckbox).toBeChecked();

    // A preview count badge should appear (e.g. "X exact matches found")
    await expect(page.getByText(/exact match/i)).toBeVisible({ timeout: 10_000 });
  });

  test("Auto-match batch opens the Auto-Match Preview dialog", async ({ page }) => {
    // Enable batch exact match
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.getByRole("button", { name: "Start Matching" }).click();

    // BatchReviewModal should open with "Auto-Match Preview" title
    await expect(page.getByText("Auto-Match Preview")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("BATCH AUTO-MATCH")).toBeVisible();
  });

  test("can cancel batch dialog and return to ready screen", async ({ page }) => {
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.getByRole("button", { name: "Start Matching" }).click();
    await expect(page.getByText("Auto-Match Preview")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    // Should be back at ready screen
    await expect(page.getByRole("button", { name: "Start Matching" })).toBeVisible();
  });

  test("Auto skip records checkbox is checkable", async ({ page }) => {
    const skipZeroCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await skipZeroCheckbox.check();
    await expect(skipZeroCheckbox).toBeChecked();
  });

  test("Auto skip low-confidence checkbox is checkable", async ({ page }) => {
    const lowConfCheckbox = page.locator('input[type="checkbox"]').nth(2);
    await lowConfCheckbox.check();
    await expect(lowConfCheckbox).toBeChecked();
  });

  test("enabling all 3 batch options and starting shows the exact step first", async ({ page }) => {
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();

    await page.getByRole("button", { name: "Start Matching" }).click();

    // Should open with exact step first (Auto-Match Preview)
    await expect(page.getByText("Auto-Match Preview")).toBeVisible({ timeout: 15_000 });
  });

  test("Auto skip records dialog shows after confirming exact step", async ({ page }) => {
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();

    await page.getByRole("button", { name: "Start Matching" }).click();

    // Confirm exact step
    await expect(page.getByText("Auto-Match Preview")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Next|Confirm/i }).click();

    // Should advance to Auto Skip Records step
    await expect(page.getByText("Auto Skip Records")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("BATCH PROCESSING")).toBeVisible();
  });

  test("low-confidence dialog shows threshold input with default 60", async ({ page }) => {
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("button", { name: "Start Matching" }).click();

    await expect(page.getByText("Low-Confidence Skip")).toBeVisible({ timeout: 20_000 });

    // Scope to the threshold input specifically — it has min="0" max="100",
    // unlike the Max Candidates input (no min/max) in the matching toolbar behind the modal.
    const thresholdInput = page.locator('input[type="number"][min="0"]');
    await expect(thresholdInput).toHaveValue("60");
  });

  test("low-confidence threshold can be changed", async ({ page }) => {
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("button", { name: "Start Matching" }).click();

    await expect(page.getByText("Low-Confidence Skip")).toBeVisible({ timeout: 20_000 });

    const thresholdInput = page.locator('input[type="number"][min="0"]');
    await thresholdInput.fill("75");
    await expect(thresholdInput).toHaveValue("75");
  });
});
