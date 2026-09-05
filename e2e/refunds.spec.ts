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

test.describe("refunds workflow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    execFileSync("pnpm", ["db:seed"], { stdio: "inherit", env: process.env });
  });

  test.beforeEach(async ({ page }) => {
    await signIn(page, ACCOUNTS.approver);
    await page.goto("/refunds?status=all");
  });

  test("restores URL state and keeps the queue usable", async ({ page }) => {
    await page.goto("/refunds?q=RFD-50&status=all&min=100&sort=amount&dir=asc");
    await expect(page.getByLabel("Search refunds")).toHaveValue("RFD-50");
    await expect(page.locator("select[name=status]")).toHaveValue("all");
    await expect(page.getByLabel("Min amount (EUR)")).toHaveValue("100");
    await expect(page.locator("table").first().getByRole("columnheader", { name: /Amount/ })).toHaveAttribute("aria-sort", "ascending");
    const queueRows = page.locator("table").first().locator("tbody tr");
    await expect(queueRows).toHaveCount(4);
    await queueRows.filter({ hasText: "RFD-5001" }).click();
    await expect(page).toHaveURL(/refund=.*step=2/);
    await page.reload();
    await expect(page.getByText("RFD-5001").last()).toBeVisible();
    await expect(page.getByLabel("Search refunds")).toHaveValue("RFD-50");
    if (test.info().project.name === "narrow") {
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test("renders the status chart text equivalent", async ({ page }) => {
    await expect(page.getByRole("img", { name: "Refund volume by status" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Refund volume by status" })).toBeAttached();
    await expect(page.getByRole("table", { name: "Refund volume by status" })).toContainText("Pending approval");
  });

  test("supports keyboard row selection and visible focus", async ({ page }) => {
    const rows = page.locator("table").first().locator("tbody tr");
    await rows.first().focus();
    await page.keyboard.press("Enter");
    await expect(rows.first()).toHaveAttribute("aria-selected", "true");
    await rows.nth(1).focus();
    await page.keyboard.press("Space");
    await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(rows.nth(1)).toHaveCSS("outline-style", "solid");
  });

  test("keeps the auditor read only", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/signin");
    await signIn(page, ACCOUNTS.auditor);
    await page.goto("/refunds");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5001" }).click();
    await expect(page.getByText(/Read only/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve refund|Reject refund|Escalate refund/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Approve|Reject|Escalate/ })).toHaveCount(0);
  });

  test("enforces threshold escalation then approval", async ({ page }) => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/signin");
    await signIn(page, ACCOUNTS.approver);
    await page.goto("/refunds");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5005" }).click();
    await page.getByRole("link", { name: "Approve" }).click();
    await page.getByRole("button", { name: "Approve refund" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /€500\.00.*escalated/ })).toHaveCount(1);
    await expect(page.getByRole("definition").filter({ hasText: "Pending approval" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/signin");
    await signIn(page, ACCOUNTS.operator);
    await page.goto("/refunds");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5005" }).click();
    await page.getByRole("link", { name: "Escalate" }).click();
    await page.getByRole("button", { name: "Escalate refund" }).click();
    await page.goto("/refunds");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5005" }).click();
    await expect(page.getByRole("definition").filter({ hasText: "Escalated" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/signin");
    await signIn(page, ACCOUNTS.approver);
    await page.goto("/refunds");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5005" }).click();
    await page.getByRole("link", { name: "Approve" }).click();
    await page.getByRole("button", { name: "Approve refund" }).click();
    await page.goto("/refunds?status=all");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5005" }).click();
    await expect(page.getByRole("definition").filter({ hasText: "Approved" })).toBeVisible();
  });

  test("validates and submits a rejection", async ({ page }) => {
    await page.goto("/refunds");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5001" }).click();
    await page.getByRole("link", { name: "Reject" }).click();
    await page.getByRole("button", { name: "Reject refund" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "at least 5 characters" })).toHaveCount(1);
    await expect(page).toHaveURL(/step=3/);
    await page.getByLabel("Rejection reason").fill("Synthetic: duplicate charge already refunded.");
    await page.getByRole("button", { name: "Reject refund" }).click();
    await page.goto("/refunds?status=all");
    await page.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5001" }).click();
    await expect(page.getByRole("definition").filter({ hasText: "Rejected" })).toBeVisible();
    await expect(page.getByText("Record version 2")).toBeVisible();
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
    await approverPage.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5002" }).click();
    await approverPage.getByRole("link", { name: "Approve" }).click();
    await adminPage.goto("/refunds");
    await adminPage.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5002" }).click();
    await adminPage.getByRole("link", { name: "Reject" }).click();
    await adminPage.getByLabel("Rejection reason").fill("Synthetic stale test.");
    await adminPage.getByRole("button", { name: "Reject refund" }).click();
    await adminPage.goto("/refunds?status=all");
    await adminPage.locator("table").first().locator("tbody tr").filter({ hasText: "RFD-5002" }).click();
    await expect(adminPage.getByRole("definition").filter({ hasText: "Rejected" })).toBeVisible();
    await approverPage.getByRole("button", { name: "Approve refund" }).click();
    await expect(approverPage.getByRole("alert").filter({ hasText: "This refund changed" })).toHaveCount(1);
    await approverPage.getByRole("link", { name: "Review latest version" }).click();
    await expect(approverPage.getByText("Rejected", { exact: true }).last()).toBeVisible();
    await approverPage.goto("/audit");
    await approverPage.getByLabel("Search audit events").fill("RFD-5002");
    await expect(approverPage.getByText("Approved refund RFD-5002")).toHaveCount(0);
    await contextA.close();
    await contextB.close();
  });
});
