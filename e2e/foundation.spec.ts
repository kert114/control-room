import { expect, test, type Page } from "@playwright/test";

const DEMO_PASSWORD = "control-room-demo";

const ACCOUNTS = {
  operator: "operator@demo.control-room.test",
  approver: "approver@demo.control-room.test",
  administrator: "admin@demo.control-room.test",
  auditor: "auditor@demo.control-room.test",
} as const;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  await page.getByLabel("Demo account").selectOption(email);
  await page.getByLabel("Demo password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in to Control Room" }).click();
  await page.waitForURL("**/overview");
}

test.describe("platform foundation", () => {
  test("unauthenticated visitors are sent to sign-in", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/signin/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Control Room" }),
    ).toBeVisible();
  });

  test("rejects an unknown demo password", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Demo account").selectOption(ACCOUNTS.operator);
    await page.getByLabel("Demo password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in to Control Room" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("operator sees overview, demo banner, and seeded workload", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await expect(page.getByTestId("demo-mode-indicator")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeVisible();
    await expect(page.getByText("Open KYC cases")).toBeVisible();
    await expect(page.getByText("Refunds awaiting approval")).toBeVisible();
    await expect(page.getByRole("img", { name: "Audit events per day" })).toBeVisible();
  });

  test("module routes are stable and render their contract", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    for (const [route, heading] of [
      ["/kyc", "KYC reviews"],
      ["/refunds", "Refunds"],
      ["/flags", "Feature flags"],
    ] as const) {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(page.getByText("Module not implemented yet")).toBeVisible();
    }
  });

  test("audit trail lists seeded events and opens the selected event", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.auditor);
    await page.goto("/audit");
    await expect(
      page.getByRole("heading", { level: 1, name: "Audit trail" }),
    ).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await expect(page.getByText("Selected event")).toBeVisible();
    await expect(page.getByText("Record history")).toBeVisible();
  });

  test("audit search filters the table and can report no results", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.auditor);
    await page.goto("/audit");
    await page.getByLabel("Search audit events").fill("refund.approved");
    const filtered = page.locator("tbody tr");
    await expect(filtered.first()).toBeVisible();
    for (const row of await filtered.all()) {
      await expect(row).toContainText("refund.approved");
    }

    await page.getByLabel("Search audit events").fill("zzzz-no-match");
    await expect(page.getByText("No matching records")).toBeVisible();
  });

  test("auditor read-only surface exposes no write access", async ({ page }) => {
    await signIn(page, ACCOUNTS.auditor);
    await page.goto("/refunds");
    await expect(page.getByText("None — read only")).toBeVisible();
  });

  test("operator write access differs from the approver", async ({ page }) => {
    await signIn(page, ACCOUNTS.operator);
    await page.goto("/refunds");
    await expect(page.getByText("refunds.request")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/signin");

    await signIn(page, ACCOUNTS.approver);
    await page.goto("/refunds");
    await expect(page.getByText("refunds.approve")).toBeVisible();
  });
});
