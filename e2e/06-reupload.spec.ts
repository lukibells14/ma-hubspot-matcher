import { test, expect, type Download } from "@playwright/test";
import { uploadBothFiles, waitForReady, startMatchingAndWait, MA_CSV, HUB_CSV } from "./helpers";

test.describe("Re-upload After Matching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("can re-upload MA CSV while matching is in progress", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });

    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(MA_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("ma-sample.csv")).toBeVisible();
  });

  test("can re-upload HubSpot CSV while matching is in progress", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    const hubInput = page.locator('input[type="file"]').nth(1);
    await hubInput.setInputFiles(HUB_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("hub-sample.csv")).toBeVisible();
  });

  test("re-uploading after all records are matched returns to ready state", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);
    await startMatchingAndWait(page);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }

    await expect(page.getByText(/Finished\. Export your table\./i)).toBeVisible({ timeout: 10_000 });

    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(MA_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    const hubInput = page.locator('input[type="file"]').nth(1);
    await hubInput.setInputFiles(HUB_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByRole("button", { name: "Start Matching" })).toBeVisible({ timeout: 20_000 });
  });

  test("can complete a full new match session after re-uploading", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);
    await startMatchingAndWait(page);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }

    await expect(page.getByText(/Finished\. Export your table\./i)).toBeVisible({ timeout: 10_000 });

    // Re-upload the same files to start fresh
    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(MA_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    const hubInput = page.locator('input[type="file"]').nth(1);
    await hubInput.setInputFiles(HUB_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Start Matching" }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByRole("button", { name: "Start Matching" }).click();

    await page.locator("text=M&A COMPANY").waitFor({ state: "visible", timeout: 30_000 });

    // Progress should start at 0 in the new session
    await expect(page.getByText(/0 \/ 5 \(0%\)/)).toBeVisible({ timeout: 5_000 });
  });

  test("exporting remaining CSV and re-uploading it starts a new session with fewer records", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);
    await startMatchingAndWait(page);

    // Make 2 out of 5 selections
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/2 \/ 5 \(40%\)/)).toBeVisible({ timeout: 5_000 });

    // Open the export modal
    await page.getByRole("button", { name: /Export to Excel/i }).click();
    await expect(page.getByText("Export Files")).toBeVisible({ timeout: 5_000 });

    // Listen for the CSV download — Download triggers both .xlsx and .csv
    let csvDownload: Download | null = null;
    const onDownload = (d: Download) => {
      if (d.suggestedFilename().endsWith(".csv")) csvDownload = d;
    };
    page.on("download", onDownload);

    await page.getByRole("button", { name: "Download" }).click();
    // Modal closes automatically after triggering downloads
    await expect(page.getByText("Export Files")).not.toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(500);
    page.off("download", onDownload);

    // Verify the remaining CSV was downloaded
    expect(csvDownload).not.toBeNull();
    const csvPath = await csvDownload!.path();
    expect(csvPath).not.toBeNull();

    // Re-upload the remaining CSV as the MA file (replaces the original 5-record file)
    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(csvPath!);
    await page.getByRole("button", { name: "Close" }).click();

    // Start a fresh matching session with the smaller file
    await page.getByRole("button", { name: "Start Matching" }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByRole("button", { name: "Start Matching" }).click();
    await page.locator("text=M&A COMPANY").waitFor({ state: "visible", timeout: 30_000 });
    await page.getByText("Indexing HubSpot", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
    await page.getByText("Preparing Review Queue", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

    // New session has 3 remaining records (5 - 2 reviewed), not 5
    await expect(page.getByText(/0 \/ 3 \(0%\)/)).toBeVisible({ timeout: 5_000 });
  });

  test("progress resets to 0 after re-upload and starting a new session", async ({ page }) => {
    await uploadBothFiles(page);
    await waitForReady(page);
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });

    // Re-upload both files
    const maInput = page.locator('input[type="file"]').nth(0);
    await maInput.setInputFiles(MA_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    const hubInput = page.locator('input[type="file"]').nth(1);
    await hubInput.setInputFiles(HUB_CSV);
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Start Matching" }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByRole("button", { name: "Start Matching" }).click();
    await page.locator("text=M&A COMPANY").waitFor({ state: "visible", timeout: 30_000 });

    await expect(page.getByText(/0 \/ 5 \(0%\)/)).toBeVisible({ timeout: 5_000 });
  });
});
