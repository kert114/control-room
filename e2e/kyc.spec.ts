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

    await page.getByLabel("Search case or customer").fill("KYC-240");
    await page.getByLabel("Risk").selectOption("high");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.waitForURL(/risk=high/);
    await expect(page).toHaveURL(/q=KYC-240/);

    await page.getByRole("columnheader", { name: /Risk/ }).getByRole("link").click();
    await page.waitForURL(/sort=risk/);

    const rows = page.getByTestId("kyc-queue").locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await rows.first().click();
    await page.waitForURL(/case=/);
    const url = page.url();

    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByLabel("Search case or customer")).toHaveValue("KYC-240");
    await expect(page.getByLabel("Risk")).toHaveValue("high");
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
    await page.getByRole("radio", { name: /^Reject case/ }).check();
    await page.getByRole("button", { name: "Reject case" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reject case" }).click();
    await expect(page.getByTestId("kyc-action-error")).toBeVisible();
    await expect(page.getByText(/rationale/i).first()).toBeVisible();

    await page.getByLabel("Rationale").fill("Synthetic adverse media confirmed; rejecting.");
    await page.getByRole("button", { name: "Reject case" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reject case" }).click();
    await expect(page.getByTestId("kyc-action-success")).toContainText(/rejected/);
    await expect(page.getByTestId("kyc-case-detail")).toContainText("Rejected");
    await expect(page.getByTestId("kyc-case-detail")).toContainText("Decisions");
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
    await expect(page.getByLabel("Rationale")).toHaveCount(0);
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
