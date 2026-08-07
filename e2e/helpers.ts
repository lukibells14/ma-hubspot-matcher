import { Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MA_CSV = path.resolve(__dirname, "fixtures/ma-sample.csv");
export const HUB_CSV = path.resolve(__dirname, "fixtures/hub-sample.csv");

/** Upload both CSVs and dismiss both summary modals. */
export async function uploadBothFiles(page: Page) {
  const maInput = page.locator('input[type="file"]').nth(0);
  await maInput.setInputFiles(MA_CSV);
  await page.getByRole("button", { name: "Close" }).click();

  const hubInput = page.locator('input[type="file"]').nth(1);
  await hubInput.setInputFiles(HUB_CSV);
  await page.getByRole("button", { name: "Close" }).click();
}

/** Wait until indexing is done and "Start Matching" is clickable. */
export async function waitForReady(page: Page) {
  await page.getByRole("button", { name: "Start Matching" }).waitFor({ state: "visible", timeout: 30_000 });
}

/** Click Start Matching (no batch options) and wait for the first MA record panel.
 *
 * The matching stage (`stage = "matching"`) is set at the same time as the loading overlay,
 * so "M&A COMPANY" becomes visible immediately — before indexing or prescreen finishes.
 * After waiting for M&A COMPANY, we also wait for both overlay phases ("Indexing HubSpot"
 * and "Preparing Review Queue") to disappear from the DOM, which confirms the overlay has
 * cleared and keyboard events are no longer blocked.
 */
export async function startMatchingAndWait(page: Page) {
  await page.getByRole("button", { name: "Start Matching" }).click();
  await page.locator("text=M&A COMPANY").waitFor({ state: "visible", timeout: 30_000 });
  // Wait for indexing overlay to clear, then for prescreen overlay to clear.
  // If either has already cleared by the time we check, waitFor resolves immediately.
  await page.getByText("Indexing HubSpot", { exact: true })
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => {});
  await page.getByText("Preparing Review Queue", { exact: true })
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => {});
}
