/**
 * Service-health integration boundary for the flags tool.
 *
 * A provider turns one monitoring system's data (Datadog monitors, Grafana
 * alert rules, Sentry issue counts, an internal status page, ...) into the
 * normalised `ServiceHealthSignal` shape below. The route only ever consumes
 * the normalised shape, so adding a real system means writing one adapter and
 * listing it in `registry.ts`; nothing in the UI changes.
 */

export const HEALTH_STATUSES = ["healthy", "degraded", "down", "unknown"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export interface ServiceHealthSignal {
  /** Service or check name as the source system labels it. */
  service: string;
  status: HealthStatus;
  /** One short line, e.g. "p95 latency 320 ms" or "3 unresolved issues". */
  detail: string;
  /** Team that owns the service; matched against `feature_flags.owner`. */
  owner: string;
  observedAt: Date;
}

export interface ServiceHealthProvider {
  /** Stable identifier, e.g. "datadog". */
  id: string;
  /** Display name, e.g. "Datadog". */
  name: string;
  fetchSignals(): Promise<ServiceHealthSignal[]>;
}

export interface ProviderReport {
  providerId: string;
  providerName: string;
  /** `unavailable` means the provider threw; its signals are omitted. */
  status: "ok" | "unavailable";
  signals: ServiceHealthSignal[];
}

export interface ServiceHealthSnapshot {
  overall: HealthStatus;
  reports: ProviderReport[];
}

const SEVERITY: Record<HealthStatus, number> = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  down: 3,
};

export function worstStatus(statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>(
    (worst, status) => (SEVERITY[status] > SEVERITY[worst] ? status : worst),
    "healthy",
  );
}

/** Queries every provider; one failing provider never hides the others. */
export async function collectServiceHealth(
  providers: readonly ServiceHealthProvider[],
): Promise<ServiceHealthSnapshot> {
  const reports = await Promise.all(
    providers.map(async (provider): Promise<ProviderReport> => {
      try {
        const signals = await provider.fetchSignals();
        return { providerId: provider.id, providerName: provider.name, status: "ok", signals };
      } catch (error: unknown) {
        console.error(`Service-health provider ${provider.id} failed.`, error);
        return { providerId: provider.id, providerName: provider.name, status: "unavailable", signals: [] };
      }
    }),
  );
  const statuses = reports.flatMap((report) =>
    report.status === "ok" ? report.signals.map((signal) => signal.status) : ["unknown" as const],
  );
  return { overall: worstStatus(statuses), reports };
}
