import type {
  HealthStatus,
  ServiceHealthProvider,
  ServiceHealthSignal,
} from "@/modules/flags/health/provider";

/**
 * Deterministic stand-ins for real monitoring systems. Each one mimics the
 * raw payload shape of the system it names, then maps it into the normalised
 * signal — exactly what a real adapter would do after an HTTP call.
 * All data is synthetic.
 */

/**
 * Each mock reports a fixed number of minutes before the current minute, so
 * the timestamps read as fresh on any day yet stay stable within a minute.
 */
function observedMinutesAgo(minutes: number): Date {
  const now = Date.now();
  return new Date(now - (now % 60_000) - minutes * 60_000);
}

interface DatadogMonitor {
  name: string;
  overall_state: "OK" | "Warn" | "Alert" | "No Data";
  message: string;
  tags: string[];
}

const DATADOG_STATE: Record<DatadogMonitor["overall_state"], HealthStatus> = {
  OK: "healthy",
  Warn: "degraded",
  Alert: "down",
  "No Data": "unknown",
};

function fromDatadog(monitor: DatadogMonitor): ServiceHealthSignal {
  const team = monitor.tags.find((tag) => tag.startsWith("team:"))?.slice(5) ?? "Unassigned";
  return {
    service: monitor.name,
    status: DATADOG_STATE[monitor.overall_state],
    detail: monitor.message,
    owner: team,
    observedAt: observedMinutesAgo(2),
  };
}

export const datadogMock: ServiceHealthProvider = {
  id: "datadog",
  name: "Datadog",
  async fetchSignals() {
    const monitors: DatadogMonitor[] = [
      {
        name: "refunds-api p95 latency",
        overall_state: "OK",
        message: "p95 latency 310 ms",
        tags: ["team:Payment operations"],
      },
      {
        name: "kyc-triage queue depth",
        overall_state: "Warn",
        message: "queue depth 1 240, above 1 000",
        tags: ["team:Financial crime operations"],
      },
    ];
    return monitors.map(fromDatadog);
  },
};

interface GrafanaAlertRule {
  title: string;
  state: "Normal" | "Pending" | "Alerting" | "NoData";
  summary: string;
  labels: { team: string };
}

const GRAFANA_STATE: Record<GrafanaAlertRule["state"], HealthStatus> = {
  Normal: "healthy",
  Pending: "degraded",
  Alerting: "down",
  NoData: "unknown",
};

function fromGrafana(rule: GrafanaAlertRule): ServiceHealthSignal {
  return {
    service: rule.title,
    status: GRAFANA_STATE[rule.state],
    detail: rule.summary,
    owner: rule.labels.team,
    observedAt: observedMinutesAgo(3),
  };
}

export const grafanaMock: ServiceHealthProvider = {
  id: "grafana",
  name: "Grafana",
  async fetchSignals() {
    const rules: GrafanaAlertRule[] = [
      {
        title: "audit-explorer error rate",
        state: "Normal",
        summary: "5xx rate 0.02%",
        labels: { team: "Platform engineering" },
      },
      {
        title: "refunds-worker success rate",
        state: "Normal",
        summary: "99.98% over 30 min",
        labels: { team: "Payment operations" },
      },
    ];
    return rules.map(fromGrafana);
  },
};

interface SentryProjectStats {
  project: string;
  unresolvedIssues: number;
  crashFreeRate: number;
  team: string;
}

function fromSentry(stats: SentryProjectStats): ServiceHealthSignal {
  const status: HealthStatus =
    stats.unresolvedIssues >= 10 ? "down" : stats.unresolvedIssues >= 3 ? "degraded" : "healthy";
  return {
    service: stats.project,
    status,
    detail: `${stats.unresolvedIssues} unresolved issues, ${stats.crashFreeRate.toFixed(2)}% crash-free`,
    owner: stats.team,
    observedAt: observedMinutesAgo(4),
  };
}

export const sentryMock: ServiceHealthProvider = {
  id: "sentry",
  name: "Sentry",
  async fetchSignals() {
    const projects: SentryProjectStats[] = [
      { project: "kyc-triage", unresolvedIssues: 4, crashFreeRate: 99.71, team: "Financial crime operations" },
      { project: "control-room-web", unresolvedIssues: 1, crashFreeRate: 99.97, team: "Platform engineering" },
    ];
    return projects.map(fromSentry);
  },
};

interface InternalStatusComponent {
  component: string;
  status: "operational" | "partial_outage" | "major_outage";
  note: string;
  owner: string;
}

const INTERNAL_STATE: Record<InternalStatusComponent["status"], HealthStatus> = {
  operational: "healthy",
  partial_outage: "degraded",
  major_outage: "down",
};

/** The company's own status page, in case no third-party system is wired up. */
export const internalStatusMock: ServiceHealthProvider = {
  id: "internal-status",
  name: "Company status page",
  async fetchSignals() {
    const components: InternalStatusComponent[] = [
      {
        component: "Instant refunds",
        status: "operational",
        note: "All regions operational",
        owner: "Payment operations",
      },
    ];
    return components.map((component) => ({
      service: component.component,
      status: INTERNAL_STATE[component.status],
      detail: component.note,
      owner: component.owner,
      observedAt: observedMinutesAgo(1),
    }));
  },
};
