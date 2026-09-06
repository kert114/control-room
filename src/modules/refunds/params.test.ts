import { describe, expect, it } from "vitest";

import {
  buildRefundsHref,
  effectiveStatuses,
  hasQueueFilters,
  parseListParams,
  rejectInputSchema,
} from "@/modules/refunds/params";

describe("refund URL state", () => {
  it("defaults to the open queue, oldest first, monthly volume", () => {
    expect(parseListParams({})).toEqual({
      q: "",
      status: [],
      sort: "createdAt",
      dir: "asc",
      range: "month",
      step: 1,
    });
    expect(effectiveStatuses([])).toEqual(["pending_approval", "escalated"]);
    expect(
      parseListParams({ status: "bad", sort: "bad", dir: "bad", range: "bad", step: "99" }),
    ).toMatchObject({ status: [], sort: "createdAt", dir: "asc", range: "month", step: 1 });
  });

  it("accepts several statuses as a comma list or repeated params", () => {
    expect(parseListParams({ status: "approved,rejected,draft" }).status).toEqual([
      "approved",
      "rejected",
    ]);
    expect(parseListParams({ status: ["approved", "escalated"] }).status).toEqual([
      "escalated",
      "approved",
    ]);
    expect(parseListParams({ status: "all" }).status).toHaveLength(5);
  });

  it("parses money filters to minor units", () => {
    expect(parseListParams({ min: "12.50" }).min).toBe(1250);
    expect(parseListParams({ min: "abc" }).min).toBeUndefined();
    expect(parseListParams({ min: "-1" }).min).toBeUndefined();
  });

  it("round-trips canonical links while omitting defaults", () => {
    const href = buildRefundsHref({
      q: " RFD-50 ",
      status: ["approved", "rejected"],
      min: 1250,
      sort: "amount",
      dir: "desc",
      range: "year",
      refund: "00000000-0000-4000-8000-000000000001",
      step: 3,
      decision: "reject",
    });
    expect(href).toBe(
      "/refunds?q=RFD-50&status=approved%2Crejected&min=12.50&sort=amount&dir=desc&range=year&refund=00000000-0000-4000-8000-000000000001&step=3&decision=reject",
    );
    expect(parseListParams(Object.fromEntries(new URL(href, "http://localhost").searchParams)))
      .toMatchObject({
        q: "RFD-50",
        status: ["approved", "rejected"],
        min: 1250,
        sort: "amount",
        dir: "desc",
        range: "year",
        step: 3,
        decision: "reject",
      });
    expect(buildRefundsHref({ status: [], dir: "asc", range: "month" })).toBe("/refunds");
  });

  it("treats only search, status and amount as queue filters", () => {
    expect(hasQueueFilters(parseListParams({ range: "week", sort: "amount" }))).toBe(false);
    expect(hasQueueFilters(parseListParams({ status: "approved" }))).toBe(true);
    expect(hasQueueFilters(parseListParams({ q: "x" }))).toBe(true);
  });

  it("validates rejection notes", () => {
    expect(rejectInputSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000001",
      version: 1,
      decisionNote: "no",
    }).error?.issues[0]?.message).toBe("Enter a rejection reason of at least 5 characters.");
    expect(rejectInputSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000001",
      version: 1,
      decisionNote: "x".repeat(501),
    }).error?.issues[0]?.message).toBe("Keep the rejection reason under 500 characters.");
  });
});
