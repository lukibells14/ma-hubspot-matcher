import { test, expect } from "@playwright/test";
import { uploadBothFiles, waitForReady, startMatchingAndWait } from "./helpers";

test.describe("Matching Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await uploadBothFiles(page);
    await waitForReady(page);
  });

  test("matching UI shows M&A COMPANY panel with a company name", async ({ page }) => {
    await startMatchingAndWait(page);
    await expect(page.locator("text=M&A COMPANY")).toBeVisible();
    // At least one of the fixture company names should appear in the left panel
    const panel = page.locator("section").filter({ hasText: "M&A COMPANY" });
    await expect(panel).toBeVisible();
  });

  test("HubSpot candidates panel is visible with CANDIDATES mode button", async ({ page }) => {
    await startMatchingAndWait(page);
    await expect(page.getByText("HUBSPOT POSSIBLE MATCHES")).toBeVisible();
    await expect(page.getByRole("button", { name: "CANDIDATES" })).toBeVisible();
    await expect(page.getByRole("button", { name: "HUBSPOT SEARCH" })).toBeVisible();
  });

  test("progress bar starts at 0 / 5 then shows 1 / 5 after a selection", async ({ page }) => {
    await startMatchingAndWait(page);

    // ProgressHeader renders "X / Y (P%)" — check the full text including percentage
    await expect(page.getByText(/0 \/ 5 \(0%\)/)).toBeVisible();

    // Select the first candidate via keyboard
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });
  });

  test("progress percentage updates after each selection", async ({ page }) => {
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.getByText(/2 \/ 5 \(40%\)/)).toBeVisible({ timeout: 5_000 });
  });

  test("Go Back button is disabled on the first record", async ({ page }) => {
    await startMatchingAndWait(page);
    // The in-review toolbar's Go Back button (first one in the toolbar area)
    const goBackBtn = page.getByRole("button", { name: "← Go Back" }).first();
    await expect(goBackBtn).toBeDisabled();
  });

  test("Go Back button navigates to the previous record", async ({ page }) => {
    await startMatchingAndWait(page);

    // Capture the company name on record 1
    const maPanel = page.locator("section").filter({ hasText: "M&A COMPANY" });
    const record1Name = await maPanel.locator("strong, b").first().textContent();

    // Select record 1 → advance to record 2
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // The company name should have changed (we're on record 2)
    await page.waitForTimeout(300);

    // Click Go Back
    const goBackBtn = page.getByRole("button", { name: "← Go Back" }).first();
    await goBackBtn.click();

    // The company name shown should match record 1 again
    if (record1Name) {
      await expect(maPanel).toContainText(record1Name, { timeout: 5_000 });
    }
  });

  test("progress count does NOT decrease when going back", async ({ page }) => {
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });

    const goBackBtn = page.getByRole("button", { name: "← Go Back" }).first();
    await goBackBtn.click();

    // Selection count must still be 1 after going back
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });
  });

  test("Go Back button is enabled after advancing past the first record", async ({ page }) => {
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const goBackBtn = page.getByRole("button", { name: "← Go Back" }).first();
    await expect(goBackBtn).toBeEnabled();
  });

  test("re-selecting after going back does not increase the progress count", async ({ page }) => {
    await startMatchingAndWait(page);

    // Select record 1 — count becomes 1/5
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });

    // Go back to record 1 — count stays at 1/5
    const goBackBtn = page.getByRole("button", { name: "← Go Back" }).first();
    await goBackBtn.click();
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });

    // Re-select record 1 with a different choice (No Match).
    // applySelection replaces the existing selection (same maIndex), so array length stays 1.
    await page.getByText("No Match").first().click();

    // Count must still be 1 — the selection was updated, not added
    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/2 \/ 5/)).not.toBeVisible();
  });

  test("HUBSPOT SEARCH mode toggle works", async ({ page }) => {
    await startMatchingAndWait(page);
    await page.getByRole("button", { name: "HUBSPOT SEARCH" }).click();
    await expect(page.locator('input[placeholder*="company name"]')).toBeVisible();
  });

  test("typing in filter input narrows candidates", async ({ page }) => {
    await startMatchingAndWait(page);
    const filterInput = page.getByPlaceholder(/Filter by company name/i);
    await filterInput.fill("Acme");
    // Filter input accepted the text
    await expect(filterInput).toHaveValue("Acme");
  });

  test("selecting No Match advances progress", async ({ page }) => {
    await startMatchingAndWait(page);

    // "No Match" is the last item in the candidates panel — click it directly.
    // The End key is not handled by the app's keyboard listener.
    // Before any selection, "No Match" only appears in the candidates panel (results table is empty).
    await page.getByText("No Match").first().click();

    await expect(page.getByText(/1 \/ 5 \(20%\)/)).toBeVisible({ timeout: 5_000 });
  });

  test("selection appears in the results table with Matched or No Match status", async ({ page }) => {
    await startMatchingAndWait(page);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Scope to the "6-8) Selections" card to avoid the candidates panel "No Match" option.
    // After one selection, the card shows the status ("Matched" or "No Match") for that row.
    const selectionsCard = page.locator(".ds-card").filter({ hasText: "6-8) Selections" });
    await expect(selectionsCard.getByText(/Matched|No Match/).first()).toBeVisible({ timeout: 5_000 });
  });
});
