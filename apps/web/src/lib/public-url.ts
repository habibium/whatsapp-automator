const DEFAULT_API_BASE = "/api";

export function getApiBase(): string {
  const configuredBase = import.meta.env["VITE_API_URL"]?.trim();
  if (!configuredBase) return DEFAULT_API_BASE;
  return configuredBase.replace(/\/$/, "");
}

export function getApiOrigin(): string {
  return new URL(getApiBase(), window.location.origin).origin;
}
