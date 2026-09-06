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

async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/signin");
}

function flagRow(page: Page, key: string, environment: string) {
  return page.getByRole("row", { name: new RegExp(`^${key} in ${environment}`) });
}

async function selectFlag(page: Page, key: string, environment: string): Promise<void> {
  await expect(page.getByTestId("flag-table")).toHaveAttribute("data-interactive", "true");
  await flagRow(page, key, environment).getByRole("link", { name: key }).click();
  await expect(page).toHaveURL(/flag=/);
  await expect(page.getByTestId("flag-detail")).toContainText(key);
}

const detail = (page: Page) => page.getByTestId("flag-detail");

/** Row selection is client-driven, so wait for the table to hydrate before interacting. */
async function openFlags(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId("flag-table")).toHaveAttribute("data-interactive", "true");
}

test.describe("feature flags", () => {
  test("restores search, environment filter, sort, and selected flag from the URL", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await openFlags(page, "/flags");
    await expect(page.getByRole("heading", { level: 1, name: "Feature flags" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Workflow" })).toContainText("Browse flags");

    await page.getByLabel("Search flags").fill("kyc");
    await page.getByLabel("Environment").selectOption("development");
    await page.getByRole("button", { name: "Filter flags" }).click();
    await expect(page).toHaveURL(/q=kyc/);
    await expect(page).toHaveURL(/env=development/);
    await expect(page.getByTestId("flag-row")).toHaveCount(1);

    await selectFlag(page, "kyc-auto-triage", "development");
    const url = page.url();
    expect(url).toMatch(/flag=[0-9a-f-]{36}/);

    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByLabel("Search flags")).toHaveValue("kyc");
    await expect(page.getByLabel("Environment")).toHaveValue("development");
    await expect(flagRow(page, "kyc-auto-triage", "development")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(detail(page)).toContainText("kyc-auto-triage");

    await page.getByRole("link", { name: /^Environment/ }).click();
    await expect(page).toHaveURL(/sort=environment/);
    await expect(page).toHaveURL(/flag=/);
  });

  test("shows a no-results state and clears filters", async ({ page }) => {
    await signIn(page, ACCOUNTS.operator);
    await page.goto("/flags?q=zzzz-nothing");
    await expect(page.getByText("No flags match these filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/flags$/);
    await expect(page.getByTestId("flag-row").first()).toBeVisible();
  });

  test("selects a row with the keyboard and keeps focus visible", async ({ page }) => {
    await signIn(page, ACCOUNTS.operator);
    await openFlags(page, "/flags");
    const first = page.getByTestId("flag-row").first();
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/flag=/);
    await expect(first).toHaveAttribute("aria-selected", "true");

    const second = page.getByTestId("flag-row").nth(1);
    await second.focus();
    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(first).toHaveAttribute("aria-selected", "false");
  });

  test("auditor sees flags read-only with no mutation controls", async ({ page }) => {
    await signIn(page, ACCOUNTS.auditor);
    await openFlags(page, "/flags");
    await selectFlag(page, "new-audit-explorer", "development");
    await expect(page.getByTestId("read-only-notice")).toContainText("Read-only");
    await expect(detail(page).getByRole("button")).toHaveCount(0);
    await expect(detail(page).getByRole("textbox")).toHaveCount(0);
  });

  test("administrator applies a development change directly with validation", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.administrator);
    await openFlags(page, "/flags?env=development");
    await selectFlag(page, "new-audit-explorer", "development");
    const form = detail(page).locator("form", { hasText: "Set rollout" });

    await form.getByLabel("On", { exact: true }).check();
    await form.getByLabel("Rollout percentage").fill("250");
    await form.getByLabel("Reason").fill("Widen the developer preview cohort.");
    await form.getByRole("button", { name: "Apply flag change" }).click();
    await expect(page.getByTestId("form-invalid")).toBeVisible();
    await expect(form.getByText("Rollout cannot exceed 100%.")).toBeVisible();
    await expect(form.getByLabel("Reason")).toHaveValue("Widen the developer preview cohort.");
    await expect(form.getByLabel("On", { exact: true })).toBeChecked();

    // Vary the target so re-runs against the same database still produce a change.
    const rollout = String(10 + (Date.now() % 80));
    await form.getByLabel("Rollout percentage").fill(rollout);
    await form.getByRole("button", { name: "Apply flag change" }).click();
    await expect(page.getByTestId("outcome-notice")).toContainText("Flag updated");
    await expect(flagRow(page, "new-audit-explorer", "development")).toContainText(`On · ${rollout}%`);
    await expect(detail(page)).toContainText("Updated new-audit-explorer in development");
  });

  test("flag picker filters by exact key without typing and survives reload", async ({ page }) => {
    await signIn(page, ACCOUNTS.operator);
    await openFlags(page, "/flags");
    await page.getByLabel("Flag", { exact: true }).selectOption("instant-refunds");
    await page.getByRole("button", { name: "Filter flags" }).click();
    await expect(page).toHaveURL(/key=instant-refunds/);
    await expect(page.getByTestId("flag-row")).toHaveCount(2);
    await page.reload();
    await expect(page.getByLabel("Flag", { exact: true })).toHaveValue("instant-refunds");
    await expect(page.getByTestId("flag-row")).toHaveCount(2);
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/flags$/);
  });

  test("service health panel shows normalised signals from every mock provider", async ({ page }) => {
    await signIn(page, ACCOUNTS.auditor);
    await openFlags(page, "/flags");
    const health = page.getByTestId("service-health");
    await expect(health).toContainText("Sources: Datadog, Grafana, Sentry, Company status page");
    await expect(health.getByText("Overall").locator("..")).toContainText("Degraded");
    await expect(health.getByRole("listitem")).toHaveCount(7);
    await expect(health.getByRole("listitem").filter({ hasText: "kyc-triage queue depth" })).toContainText(
      "Degraded",
    );
  });

  test("administrator restricts a development rollout to selected regions", async ({ page }) => {
    await signIn(page, ACCOUNTS.administrator);
    await openFlags(page, "/flags?env=development");
    await selectFlag(page, "kyc-auto-triage", "development");
    const form = detail(page).locator("form", { hasText: "Set rollout" });

    const before = await form.getByLabel("Estonia (EE)").isChecked();
    await form.getByLabel("Estonia (EE)").setChecked(!before);
    await form.getByLabel("Reason").fill("Limit the triage preview to one region.");
    await form.getByRole("button", { name: "Apply flag change" }).click();
    await expect(page.getByTestId("outcome-notice")).toContainText("Flag updated");
    await expect(detail(page)).toContainText(before ? "Everyone in the rollout" : "country is one of EE");
    await expect(form.getByLabel("Estonia (EE)")).toHaveJSProperty("checked", !before);
  });

  test("production change needs a second person: operator requests, approver applies", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.operator);
    await openFlags(page, "/flags?env=production");
    await selectFlag(page, "kyc-auto-triage", "production");

    const form = detail(page).locator("form", { hasText: "Propose a production change" });
    await form.getByLabel("On", { exact: true }).check();
    await form.getByLabel("Rollout percentage").fill("15");
    await form.getByLabel("Reason").fill("Extend the pilot to the next risk band.");
    await form.getByLabel(/Ticket/).fill("PLAT-500");
    await form.getByRole("button", { name: "Submit change request" }).click();
    await expect(page.getByTestId("outcome-notice")).toContainText("Change request submitted");
    const reference = /CR-\d+/.exec(await page.getByTestId("outcome-notice").innerText())?.[0];
    expect(reference).toBeTruthy();

    await page.reload();
    await expect(page.getByRole("list", { name: "Workflow" })).toContainText("Approve production");
    await expect(page.getByTestId("request-detail")).toContainText("Awaiting a second person");
    await expect(page.getByRole("button", { name: `Cancel request ${reference}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve change" })).toHaveCount(0);

    const requestUrl = page.url();
    await signOut(page);

    await signIn(page, ACCOUNTS.approver);
    await openFlags(page, requestUrl);
    const requestPanel = page.getByTestId("request-detail");
    await expect(requestPanel).toContainText(reference ?? "");
    await expect(requestPanel.getByTestId("before-after")).toContainText("Off");
    await expect(requestPanel.getByTestId("before-after")).toContainText("On · 15%");
    await expect(requestPanel).toContainText("Extend the pilot to the next risk band.");
    await expect(requestPanel).toContainText("PLAT-500");

    await requestPanel.getByLabel(/Decision note/).fill("Error budget is healthy.");
    await requestPanel.getByRole("button", { name: "Approve change" }).click();
    await expect(page.getByTestId("outcome-notice")).toContainText("Approved and applied");
    await expect(flagRow(page, "kyc-auto-triage", "production")).toContainText("On · 15%");
    await expect(page.getByTestId("request-detail")).toContainText("Applied");
    await expect(detail(page)).toContainText("Approved change request");
    await expect(detail(page)).toContainText("Applied change request");
  });

  test("kill switch requires the exact flag key and still needs approval in production", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.administrator);
    await openFlags(page, "/flags?env=production");
    await selectFlag(page, "kyc-auto-triage", "production");
    await page.getByRole("link", { name: "Request kill switch…" }).click();
    await expect(page).toHaveURL(/action=kill/);

    const form = detail(page).locator("form", { hasText: "Kill switch" });
    await form.getByLabel(/Type the flag key/).fill("kyc-auto-triag");
    await form.getByLabel("Reason").fill("Scoring drift detected in the pilot cohort.");
    await form.getByRole("button", { name: "Request kill switch" }).click();
    await expect(page.getByTestId("form-failure")).toContainText("Type the flag key exactly");
    await expect(form.getByLabel("Reason")).toHaveValue(
      "Scoring drift detected in the pilot cohort.",
    );

    await form.getByLabel(/Type the flag key/).fill("kyc-auto-triage");
    await form.getByRole("button", { name: "Request kill switch" }).click();
    await expect(page.getByTestId("outcome-notice")).toContainText("Kill switch requested");

    await page.reload();
    await expect(page.getByTestId("request-detail")).toContainText("Kill switch");
    await expect(page.getByTestId("request-detail")).toContainText("Pending approval");
    // The administrator raised it, so even with approval rights they cannot decide it.
    await expect(page.getByRole("button", { name: "Approve kill switch" })).toHaveCount(0);
    await expect(flagRow(page, "kyc-auto-triage", "production")).not.toContainText("Killed");

    const url = page.url();
    await signOut(page);
    await signIn(page, ACCOUNTS.approver);
    await openFlags(page, url);
    await page.getByRole("button", { name: "Approve kill switch" }).click();
    await expect(page.getByTestId("outcome-notice")).toContainText("Approved and applied");
    await expect(flagRow(page, "kyc-auto-triage", "production")).toContainText("Killed");
  });
});
