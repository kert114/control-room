import { describe, expect, it, vi } from "vitest";

import { collectServiceHealth, type ServiceHealthProvider } from "@/modules/flags/health/provider";
import {
  datadogMock,
  grafanaMock,
  internalStatusMock,
  sentryMock,
} from "@/modules/flags/health/mock-providers";

describe("service-health mocks", () => {
  it("report observations from the last few minutes, aligned to the minute", async () => {
    const before = Date.now();
    const signals = (
      await Promise.all(
        [datadogMock, grafanaMock, sentryMock, internalStatusMock].map((p) => p.fetchSignals()),
      )
    ).flat();
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) {
      const age = before - signal.observedAt.getTime();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(6 * 60 * 1000);
      expect(signal.observedAt.getSeconds()).toBe(0);
    }
  });

  it("logs a failing provider server-side while reporting it unavailable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken: ServiceHealthProvider = {
      id: "broken",
      name: "Broken",
      fetchSignals: async () => {
        throw new Error("timeout");
      },
    };
    const snapshot = await collectServiceHealth([broken, internalStatusMock]);
    expect(snapshot.reports[0]).toMatchObject({ providerId: "broken", status: "unavailable" });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("broken"),
      expect.objectContaining({ message: "timeout" }),
    );
    error.mockRestore();
  });
});
