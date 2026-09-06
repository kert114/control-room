import { describe, expect, it } from "vitest";

import {
  buildRefundsHref,
  parseListParams,
  rejectInputSchema,
} from "@/modules/refunds/params";

describe("refund URL state", () => {
  it("parses defaults and invalid values safely", () => {
    expect(parseListParams({})).toEqual({
      q: "",
      status: "open",
      sort: "createdAt",
      dir: "desc",
      step: 1,
    });
    expect(
      parseListParams({ status: "bad", sort: "bad", dir: "bad", step: "99" }),
    ).toMatchObject({ status: "open", sort: "createdAt", dir: "desc", step: 1 });
  });

  it("parses money filters to minor units", () => {
    expect(parseListParams({ min: "12.50" }).min).toBe(1250);
    expect(parseListParams({ min: "abc" }).min).toBeUndefined();
    expect(parseListParams({ min: "-1" }).min).toBeUndefined();
  });

  it("round-trips canonical links while omitting defaults", () => {
    const href = buildRefundsHref({
      q: " RFD-50 ",
      status: "all",
      min: 1250,
      sort: "amount",
      dir: "asc",
      refund: "00000000-0000-4000-8000-000000000001",
      step: 3,
      decision: "reject",
    });
    expect(href).toBe(
      "/refunds?q=RFD-50&status=all&min=12.50&sort=amount&dir=asc&refund=00000000-0000-4000-8000-000000000001&step=3&decision=reject",
    );
    expect(parseListParams(Object.fromEntries(new URL(href, "http://localhost").searchParams)))
      .toMatchObject({
        q: "RFD-50",
        status: "all",
        min: 1250,
        sort: "amount",
        dir: "asc",
        step: 3,
        decision: "reject",
      });
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
