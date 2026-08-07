import { test, expect } from "@playwright/test";
import { uploadBothFiles, waitForReady, startMatchingAndWait } from "./helpers";

test.describe("Export", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await uploadBothFiles(page);
    await waitForReady(page);
  });

  test("Export to Excel button is disabled before any selection", async ({ page }) => {
    const exportBtn = page.getByRole("button", { name: /Export to Excel/i });
    await expect(exportBtn).toBeDisabled();
  });

  test("Export to Excel button is enabled after a selection", async ({ page }) => {
    await startMatchingAndWait(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    const exportBtn = page.getByRole("button", { name: /Export to Excel/i });
    await expect(exportBtn).toBeEnabled({ timeout: 5_000 });
  });

  test("Export modal opens with Excel filename input", async ({ page }) => {
    await startMatchingAndWait(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /Export to Excel/i }).click();

    await expect(page.getByText("Export Files")).toBeVisible();
    // Excel file name input
    await expect(page.getByRole("textbox", { name: /Excel file name/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Excel file name/i })).toHaveValue("ma_hubspot_matches");
  });

  test("Export modal shows remaining CSV input when matching is in progress", async ({ page }) => {
    await startMatchingAndWait(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    // Wait for the selection to be recorded before opening export modal
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /Export to Excel/i }).click();
    await expect(page.getByText("Export Files")).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText(/Remaining MA records/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("textbox", { name: /Remaining MA records/i })).toHaveValue("remaining_ma");
  });

  test("can change the Excel file name before downloading", async ({ page }) => {
    await startMatchingAndWait(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /Export to Excel/i }).click();

    const xlsxInput = page.getByRole("textbox", { name: /Excel file name/i });
    await xlsxInput.fill("my_custom_export");
    await expect(xlsxInput).toHaveValue("my_custom_export");
  });

  test("Download button triggers an Excel file download", async ({ page }) => {
    await startMatchingAndWait(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /Export to Excel/i }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("Export modal shows only Excel input (no remaining CSV) when matching is done", async ({ page }) => {
    await startMatchingAndWait(page);

    // Complete all 5 records
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }

    await expect(page.getByText(/Finished\. Export your table\./i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Export to Excel/i }).click();

    // Remaining MA records input should NOT appear when matching is finished
    await expect(page.getByText(/Remaining MA records/i)).not.toBeVisible();
  });

  test("Export to Excel is available and downloads after matching is finished", async ({ page }) => {
    await startMatchingAndWait(page);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }

    await expect(page.getByText(/Finished\. Export your table\./i)).toBeVisible({ timeout: 10_000 });

    const exportBtn = page.getByRole("button", { name: /Export to Excel/i });
    await expect(exportBtn).toBeEnabled();
    await exportBtn.click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("Export modal can be cancelled without downloading", async ({ page }) => {
    await startMatchingAndWait(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await page.getByRole("button", { name: /Export to Excel/i }).click();
    await expect(page.getByText("Export Files")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Export Files")).not.toBeVisible();
  });
});
