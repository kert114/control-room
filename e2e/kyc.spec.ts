import { expect, test, type Page } from "@playwright/test";

const DEMO_PASSWORD = "control-room-demo";

const ACCOUNTS = {
  operator: "operator@demo.control-room.test",
  approver: "approver@demo.control-room.test",
  auditor: "auditor@demo.control-room.test",
} as const;

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  await page.getByLabel("Demo account").selectOption(email);
  await page.getByLabel("Demo password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in to Control Room" }).click();
  await page.waitForURL("**/overview");
}

async function openQueue(page: Page, path = "/kyc"): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId("kyc-queue")).toHaveAttribute("data-hydrated", "true");
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const [scrollWidth, innerWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test.describe("KYC review workflow", () => {
  test("queue filters, sort, and selected case survive a reload via the URL", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await openQueue(page);

    await page.getByLabel(/^Search case/).fill("KYC-240");
    await page.waitForURL(/q=KYC-240/);
    const highRisk = page.getByRole("group", { name: /Risk/ }).getByRole("button", { name: "High" });
    await highRisk.click();
    await page.waitForURL(/risk=high/);
    await expect(highRisk).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Apply filters" })).toHaveCount(0);

    await page.getByRole("columnheader", { name: /Risk/ }).getByRole("link").click();
    await page.waitForURL(/sort=risk/);

    const rows = page.getByTestId("kyc-queue").locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await rows.first().click();
    await page.waitForURL(/case=/);
    const url = page.url();

    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByLabel(/^Search case/)).toHaveValue("KYC-240");
    await expect(highRisk).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("columnheader", { name: /Risk/ }),
    ).toHaveAttribute("aria-sort", /ascending|descending/);
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAttribute("aria-selected", "true");
    await expect(rows.first()).toContainText("Selected");
    await expect(page.getByTestId("kyc-case-detail")).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Step 2" }),
    ).toContainText("current");
  });

  test("status and risk filters combine several values without an apply step", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await openQueue(page);
    const status = page.getByRole("group", { name: /Status/ });
    await status.getByRole("button", { name: "Approved" }).click();
    await page.waitForURL(/status=approved/);
    await status.getByRole("button", { name: "Rejected" }).click();
    await page.waitForURL(/status=approved&status=rejected/);
    const rows = page.getByTestId("kyc-queue").locator("tbody tr");
    const closed = await rows.count();
    expect(closed).toBeGreaterThanOrEqual(2);
    for (const row of await rows.all()) {
      await expect(row).toContainText("Closed");
    }

    const risk = page.getByRole("group", { name: /Risk/ });
    await risk.getByRole("button", { name: "Low" }).click();
    await page.waitForURL(/risk=low/);
    await expect(rows).toHaveCount(1);
    await risk.getByRole("button", { name: "Medium" }).click();
    await page.waitForURL(/risk=low&risk=medium/);
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) {
      await expect(row).toContainText(/Low|Medium/);
    }

    await page.reload();
    await expect(status.getByRole("button", { name: "Approved" })).toHaveAttribute("aria-pressed", "true");
    await expect(risk.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.waitForURL(/\/kyc$/);
    await expect(rows).toHaveCount(5);
  });

  test("free-text search matches the country name behind the stored code", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await openQueue(page);
    await expect(page.getByLabel("Country", { exact: true })).toContainText("Estonia (EE)");
    await page.getByLabel(/^Search case/).fill("Estonia");
    await page.waitForURL(/q=Estonia/);
    const rows = page.getByTestId("kyc-queue").locator("tbody tr");
    await expect(rows.first()).toContainText("Estonia");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("queue says who each case is waiting on", async ({ page }) => {
    await signIn(page, ACCOUNTS.approver);
    await openQueue(page);
    await expect(page.getByText(/waiting on you/)).toBeVisible();
    const escalated = page.getByTestId("kyc-row-KYC-2404");
    await expect(escalated).toContainText("Your action");
    await expect(escalated).toContainText("final decision");
    await escalated.click();
    await page.waitForURL(/case=/);
    await expect(page.getByTestId("kyc-case-detail")).toContainText("Waiting on");
  });

  test("documents open as PDFs through the authenticated route", async ({ page }) => {
    await signIn(page, ACCOUNTS.auditor);
    await openQueue(page);
    await page.getByTestId("kyc-row-KYC-2403").click();
    await page.waitForURL(/case=/);
    const link = page.getByTestId("kyc-document-link").first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/kyc\/documents\//);
    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const body = await response.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    const missing = await page.request.get("/kyc/documents/00000000-0000-4000-8000-000000000000");
    expect(missing.status()).toBe(404);
  });

  test("shows the no-results state and clears back to the full queue", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await page.goto("/kyc?q=does-not-exist");
    await expect(page.getByText("No cases match these filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).last().click();
    await page.waitForURL(/\/kyc$/);
    await expect(page.getByTestId("kyc-queue").locator("tbody tr")).toHaveCount(5);
  });

  test("rows can be selected with Enter and Space", async ({ page }) => {
    await signIn(page, ACCOUNTS.operator);
    await openQueue(page);

    const first = page.getByTestId("kyc-row-KYC-2401");
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/case=/);
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("kyc-case-detail")).toContainText("KYC-2401");

    const second = page.getByTestId("kyc-row-KYC-2402");
    await second.focus();
    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(first).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("kyc-case-detail")).toContainText("KYC-2402");
  });

  test("a case waiting on the customer can be resumed into review", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Mutates seeded data; run once per seed.",
    );
    await signIn(page, ACCOUNTS.operator);
    await openQueue(page, "/kyc?status=in_review&assignee=me");
    const rows = page.getByTestId("kyc-queue").locator("tbody tr");
    expect(await rows.count(), "reseed the database: no case in review").toBeGreaterThan(0);
    await rows.first().click();
    await page.waitForURL(/case=/);

    await page.getByLabel("What the customer must provide").fill("Certified copy of the passport.");
    await page.getByRole("button", { name: "Request information" }).click();
    await expect(page.getByTestId("kyc-action-success")).toContainText(/information/i);
    const detail = page.getByTestId("kyc-case-detail");
    await expect(detail).toContainText("Information requested");
    await expect(detail).toContainText("Customer");

    await page.getByRole("button", { name: "Resume review" }).click();
    await expect(page.getByTestId("kyc-action-success")).toContainText(/in review/i);
    await expect(detail).toContainText("In review");
    await expect(detail).toContainText("Your action");
  });

  test("operator claims a pending case and records a decision", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Mutates seeded data; run once per seed.",
    );
    await signIn(page, ACCOUNTS.operator);
    await openQueue(page, "/kyc?status=pending_review");
    const pending = page.getByTestId("kyc-queue").locator("tbody tr");
    const hasPending = (await pending.count()) > 0;
    if (hasPending) {
      await pending.first().click();
      await page.waitForURL(/case=/);
      await page.getByRole("button", { name: "Claim case" }).click();
      await expect(page.getByTestId("kyc-action-success")).toContainText(
        /now in review and assigned to you/,
      );
      await expect(page.getByTestId("kyc-case-detail")).toContainText("In review");
    } else {
      // A previous run against this seed already claimed the pending case; continue
      // with a case in review. Reseed (`pnpm db:seed`) to exercise the claim again.
      await openQueue(page, "/kyc?status=in_review&assignee=me");
      expect(await pending.count(), "reseed the database: no open case to decide").toBeGreaterThan(0);
      await pending.first().click();
      await page.waitForURL(/case=/);
    }

    await page.getByRole("link", { name: "Continue to decision" }).click();
    await page.waitForURL(/step=decide/);
    await expect(
      page.getByRole("listitem").filter({ hasText: "Step 3" }),
    ).toContainText("current");

    // Validation keeps the form and explains the problem inline.
    await page.getByRole("radio", { name: /^Approve case/ }).check();
    await page.getByRole("button", { name: "Approve case" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve case" }).click();
    await expect(page.getByTestId("kyc-action-error")).toBeVisible();
    await expect(page.getByText(/checklist item/i).first()).toBeVisible();

    // Rationale is optional: reject without one.
    await expect(page.getByLabel(/Rationale/)).toHaveValue("");
    await page.getByRole("radio", { name: /^Reject case/ }).check();
    await page.getByRole("button", { name: "Reject case" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reject case" }).click();
    await expect(page.getByTestId("kyc-action-success")).toContainText(/rejected/);
    await expect(page.getByTestId("kyc-case-detail")).toContainText("Rejected");
    await expect(page.getByTestId("kyc-case-detail")).toContainText("No rationale recorded");
  });

  test("identity values are masked until explicitly revealed", async ({ page }) => {
    await signIn(page, ACCOUNTS.approver);
    await openQueue(page);
    await page.getByTestId("kyc-row-KYC-2404").click();
    await page.waitForURL(/case=/);

    const document = page.getByTestId("identity-document_number");
    await expect(document).toContainText("••••");
    const html = await page.content();
    expect(html).not.toContain("SYN-");

    await document.getByRole("button", { name: /Reveal/ }).click();
    await expect(document).not.toContainText("••••");
    await expect(document).toContainText("recorded in the audit trail");
    await document.getByRole("button", { name: /Hide/ }).click();
    await expect(document).toContainText("••••");
  });

  test("auditor gets a read-only view with no actions", async ({ page }) => {
    await signIn(page, ACCOUNTS.auditor);
    await openQueue(page);
    await page.getByTestId("kyc-row-KYC-2402").click();
    await page.waitForURL(/case=/);

    const detail = page.getByTestId("kyc-case-detail");
    await expect(detail).toContainText("KYC-2402");
    await expect(page.getByTestId("kyc-read-only").first()).toBeVisible();
    await expect(detail.getByRole("button", { name: /Claim|Reassign|Request|Approve|Reject|Reveal/ })).toHaveCount(0);
    await expect(detail.getByRole("link", { name: "Continue to decision" })).toHaveCount(0);
    await expect(detail.getByRole("button", { name: /Next/ })).toHaveCount(0);

    // Forcing the decision step in the URL does not expose a decision form.
    await page.goto(`${page.url()}&step=decide`);
    await expect(page.getByLabel(/Rationale/)).toHaveCount(0);
  });

  test("layout has no horizontal page scroll in the queue and detail", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await openQueue(page);
    await expect(page.getByTestId("kyc-queue")).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByTestId("kyc-row-KYC-2404").click();
    await page.waitForURL(/case=/);
    await expect(page.getByTestId("kyc-case-detail")).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`${page.url()}&step=decide`);
    await expect(page.getByTestId("kyc-case-detail")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
