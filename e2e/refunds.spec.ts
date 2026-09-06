import { execFileSync } from "node:child_process";

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

async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/signin");
  await signIn(page, email);
  await page.goto("/refunds");
}

function queueRows(page: Page) {
  return page.locator("table").first().locator("tbody tr");
}

function row(page: Page, reference: string) {
  return queueRows(page).filter({ hasText: reference });
}

async function assertNoHorizontalScroll(page: Page): Promise<void> {
  if (test.info().project.name === "narrow") {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
}

test.describe("refunds workflow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    execFileSync("pnpm", ["db:seed"], { stdio: "inherit", env: process.env });
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.approver);
    await page.goto("/refunds");
  });

  test("opens on the open queue, oldest first, with open/closed stated in words", async ({ page }) => {
    await expect(queueRows(page)).toHaveCount(3);
    await expect(page.getByText("Showing open requests")).toBeVisible();
    await expect(queueRows(page).first()).toContainText("Open");
    await expect(page.getByRole("link", { name: /Approved/ })).toHaveAttribute("aria-pressed", "false");
    await expect(row(page, "RFD-5005")).toContainText("Needs escalation");
    await expect(page.getByRole("columnheader", { name: /^Requested [↑↓]$/ })).toHaveAttribute("aria-sort", "ascending");
    await assertNoHorizontalScroll(page);
  });

  test("status chips apply on click, combine, and clear all resets to open", async ({ page }) => {
    await page.getByRole("link", { name: /Approved/ }).click();
    await expect(page).toHaveURL(/status=pending_approval%2Cescalated%2Capproved|status=pending_approval,escalated,approved/);
    await expect(queueRows(page)).toHaveCount(4);
    await page.getByRole("link", { name: /Rejected/ }).click();
    await expect(queueRows(page)).toHaveCount(5);
    await expect(row(page, "RFD-5003")).toContainText("Closed");
    await page.getByRole("link", { name: "Open", exact: true }).click();
    await expect(queueRows(page)).toHaveCount(2);
    await expect(page.getByRole("link", { name: /Pending approval/ })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("link", { name: "Clear all filters" }).click();
    await expect(page).toHaveURL(/\/refunds$/);
    await expect(queueRows(page)).toHaveCount(3);
  });

  test("restores URL state including search, amounts, sort and volume period", async ({ page }) => {
    await page.goto("/refunds?q=RFD-50&status=all&min=100&sort=amount&dir=desc&range=year");
    await expect(page.getByLabel("Search")).toHaveValue("RFD-50");
    await expect(page.getByLabel("Min (EUR)")).toHaveValue("100");
    await expect(page.locator("table").first().getByRole("columnheader", { name: /Amount/ })).toHaveAttribute("aria-sort", "descending");
    await expect(queueRows(page)).toHaveCount(4);
    await expect(queueRows(page).first()).toContainText("RFD-5002");
    await expect(page.getByRole("link", { name: "Year" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("img", { name: "Refund volume by status (Year)" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Refund volume by status (Year)" })).toContainText("Pending approval");
    await page.getByRole("link", { name: "Week" }).click();
    await expect(page).toHaveURL(/range=week/);
    await expect(page.getByLabel("Search")).toHaveValue("RFD-50");
    await row(page, "RFD-5001").click();
    await expect(page).toHaveURL(/refund=.*step=2/);
    await page.reload();
    await expect(page.getByText("RFD-5001").last()).toBeVisible();
    await expect(page.getByLabel("Search")).toHaveValue("RFD-50");
    await page.getByLabel("Search").fill("Customer");
    await page.getByLabel("Search").press("Enter");
    await expect(page).toHaveURL(/q=Customer/);
    await expect(page).toHaveURL(/refund=/);
  });

  test("supports keyboard row selection and visible focus", async ({ page }) => {
    const rows = queueRows(page);
    await page.waitForLoadState("networkidle");
    await expect(async () => {
      await rows.first().focus();
      await page.keyboard.press("Enter");
      await expect(rows.first()).toHaveAttribute("aria-selected", "true", { timeout: 1500 });
    }).toPass();
    await rows.nth(1).focus();
    await page.keyboard.press("Space");
    await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(rows.nth(1)).toHaveCSS("outline-style", "solid");
  });

  test("shows simulated customer transactions with outliers for the reviewer", async ({ page }) => {
    await row(page, "RFD-5002").click();
    const history = page.getByTestId("transaction-history");
    await expect(history).toContainText("Customer transactions");
    await expect(page.getByTestId("refund-outlier")).toContainText("× the median");
    await history.locator("summary").click();
    await expect(page.getByRole("table", { name: "Simulated customer transactions" })).toBeVisible();
    await expect(page.getByText("Simulated data for review context only.")).toBeVisible();
    await expect(history.getByText("Refund requested")).toBeVisible();
    await expect(history.getByText("! Outlier").first()).toBeVisible();
    await assertNoHorizontalScroll(page);
  });

  test("shows only decisions the role can take and explains rule blocks", async ({ page }) => {
    await row(page, "RFD-5005").click();
    await expect(page.getByText(/Approve refund unavailable.*€500\.00/)).toBeVisible();
    await expect(page.getByText(/cannot escalate/)).toHaveCount(0);
    await expect(page.getByText(/Escalate refund unavailable/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve refund" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject…" })).toBeVisible();
  });

  test("keeps the auditor read only", async ({ page }) => {
    await switchTo(page, ACCOUNTS.auditor);
    await row(page, "RFD-5005").click();
    await expect(page.getByText(/Read only/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve refund|Reject|Escalate refund/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open in audit trail" })).toBeVisible();
  });

  test("enforces threshold escalation then approval, advancing to the next open refund", async ({ page }) => {
    await switchTo(page, ACCOUNTS.operator);
    await row(page, "RFD-5005").click();
    await expect(page.getByRole("button", { name: /Approve refund|Reject/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Escalate refund" }).click();
    await expect(page.getByText("Refund RFD-5005 escalated")).toBeVisible();

    await switchTo(page, ACCOUNTS.approver);
    await row(page, "RFD-5005").click();
    await expect(page.getByText("Escalated", { exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "Approve refund" }).click();
    await expect(page.getByText("Refund RFD-5005 approved")).toBeVisible();
    await page.getByRole("link", { name: /Next open refund/ }).click();
    await expect(page).toHaveURL(/refund=/);
    await expect(page.getByRole("button", { name: /Approve refund|Reject…/ }).first()).toBeVisible();
    await page.getByRole("link", { name: /Approved/ }).click();
    await row(page, "RFD-5005").click();
    await expect(page.getByText("Closed", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Approved", { exact: true }).last()).toBeVisible();
  });

  test("validates and submits a rejection inline", async ({ page }) => {
    await row(page, "RFD-5001").click();
    await page.getByRole("button", { name: "Reject…" }).click();
    await page.getByRole("button", { name: "Reject refund" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "at least 5 characters" })).toHaveCount(1);
    await page.getByLabel("Rejection reason").fill("Synthetic: duplicate charge already refunded.");
    await page.getByRole("button", { name: "Reject refund" }).click();
    await expect(page.getByText("Refund RFD-5001 rejected")).toBeVisible();
    await page.goto("/refunds?status=rejected");
    await row(page, "RFD-5001").click();
    await expect(page.getByText("Decision note")).toBeVisible();
  });

  test("blocks stale approval without a second audit event", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const approverPage = await contextA.newPage();
    const adminPage = await contextB.newPage();
    await signIn(approverPage, ACCOUNTS.approver);
    await signIn(adminPage, ACCOUNTS.administrator);
    await approverPage.goto("/refunds");
    await row(approverPage, "RFD-5002").click();
    await expect(approverPage.getByRole("button", { name: "Approve refund" })).toBeVisible();
    await adminPage.goto("/refunds");
    await row(adminPage, "RFD-5002").click();
    await adminPage.getByRole("button", { name: "Reject…" }).click();
    await adminPage.getByLabel("Rejection reason").fill("Synthetic stale test.");
    await adminPage.getByRole("button", { name: "Reject refund" }).click();
    await expect(adminPage.getByText("Refund RFD-5002 rejected")).toBeVisible();
    await approverPage.getByRole("button", { name: "Approve refund" }).click();
    await expect(approverPage.getByRole("alert").filter({ hasText: "This refund changed" })).toHaveCount(1);
    await approverPage.getByRole("button", { name: "Review latest version" }).click();
    await expect(approverPage.getByText("Rejected", { exact: true }).last()).toBeVisible();
    await approverPage.goto("/audit");
    await approverPage.getByLabel("Search audit events").fill("RFD-5002");
    await expect(approverPage.getByText("Approved refund RFD-5002")).toHaveCount(0);
    await contextA.close();
    await contextB.close();
  });
});
