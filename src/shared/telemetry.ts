const isTelemetryEnabled =
  (import.meta.env.VITE_ENABLE_TELEMETRY as string | undefined) === '1' ||
  (import.meta.env.VITE_ENABLE_TELEMETRY as string | undefined) === 'true' ||
  process.env.NODE_ENV === 'development';

export function trackPageView(name: string) {
  if (!isTelemetryEnabled) return;
  console.info(`[Telemetry] Page view: ${name}`);
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!isTelemetryEnabled) return;
  console.info(`[Telemetry] Event: ${name}`, props ?? {});
}
