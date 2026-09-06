import {
  datadogMock,
  grafanaMock,
  internalStatusMock,
  sentryMock,
} from "@/modules/flags/health/mock-providers";
import {
  collectServiceHealth,
  type ServiceHealthProvider,
  type ServiceHealthSnapshot,
} from "@/modules/flags/health/provider";

/**
 * Providers consulted by the /flags route, in display order.
 * To connect a real system, implement `ServiceHealthProvider` (HTTP call +
 * mapping to `ServiceHealthSignal`) and replace or add it here.
 */
export const SERVICE_HEALTH_PROVIDERS: readonly ServiceHealthProvider[] = [
  datadogMock,
  grafanaMock,
  sentryMock,
  internalStatusMock,
];

export function getServiceHealth(
  providers: readonly ServiceHealthProvider[] = SERVICE_HEALTH_PROVIDERS,
): Promise<ServiceHealthSnapshot> {
  return collectServiceHealth(providers);
}
