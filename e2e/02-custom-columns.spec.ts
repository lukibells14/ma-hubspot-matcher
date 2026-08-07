import { test, expect } from "@playwright/test";
import { uploadBothFiles, waitForReady } from "./helpers";

test.describe("Custom Columns", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await uploadBothFiles(page);
    await waitForReady(page);
  });

  test("+ Add Custom Columns button opens the builder", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Custom Columns" }).click();
    // Modal title
    await expect(page.getByText("Custom Columns").last()).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New Column" })).toBeVisible();
  });

  test("can create a custom column with a name", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Custom Columns" }).click();
    await page.getByRole("button", { name: "+ New Column" }).click();

    // Name input uses placeholder "e.g. Prospect/Client"
    const nameInput = page.getByPlaceholder("e.g. Prospect/Client");
    await nameInput.fill("Deal Status");
    await expect(nameInput).toHaveValue("Deal Status");
  });

  test("custom column count shows in builder footer after adding", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Custom Columns" }).click();
    await page.getByRole("button", { name: "+ New Column" }).click();

    const nameInput = page.getByPlaceholder("e.g. Prospect/Client");
    await nameInput.fill("Priority");

    // Footer shows "1 custom column defined"
    await expect(page.getByText(/1 custom column/i)).toBeVisible();
  });

  test("can set a rule output value", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Custom Columns" }).click();
    await page.getByRole("button", { name: "+ New Column" }).click();

    const nameInput = page.getByPlaceholder("e.g. Prospect/Client");
    await nameInput.fill("Tier");

    // The rule output input has placeholder "value if matched"
    const outputInput = page.getByPlaceholder("value if matched").first();
    await expect(outputInput).toBeVisible();
    await outputInput.fill("Tier 1");
    await expect(outputInput).toHaveValue("Tier 1");
  });

  test("Done button closes the builder", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Custom Columns" }).click();
    await expect(page.getByRole("button", { name: "+ New Column" })).toBeVisible();

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "+ New Column" })).not.toBeVisible();
  });

  test("builder button label updates to Edit Custom Columns after adding one", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Custom Columns" }).click();
    await page.getByRole("button", { name: "+ New Column" }).click();

    const nameInput = page.getByPlaceholder("e.g. Prospect/Client");
    await nameInput.fill("Revenue");

    await page.getByRole("button", { name: "Done" }).click();

    // Button in the ready section should now say "Edit Custom Columns"
    await expect(page.getByRole("button", { name: "Edit Custom Columns" })).toBeVisible();
  });
});
