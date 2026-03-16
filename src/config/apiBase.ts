import { resolveApiBase } from "./apiBaseResolver";

const importMetaEnv: Record<string, any> =
  typeof globalThis !== "undefined" && (globalThis as any).__APP_RUNTIME_ENV__
    ? (globalThis as any).__APP_RUNTIME_ENV__
    : {};

const processEnv: Record<string, any> =
  typeof process !== "undefined" && process?.env ? process.env : {};

const runtimeLocation =
  typeof window !== "undefined" && window?.location ? window.location : null;

const fallbackUiOrigin = (() => {
  const rawValue = String(processEnv.UI_BASE_URL || "").trim();
  if (!rawValue) return "";
  try {
    return new URL(rawValue).origin;
  } catch {
    return "";
  }
})();

export default resolveApiBase({
  mode: importMetaEnv.MODE || processEnv.NODE_ENV || "",
  isDev:
    typeof importMetaEnv.DEV === "boolean"
      ? Boolean(importMetaEnv.DEV)
      : String(processEnv.NODE_ENV || "").trim().toLowerCase() === "development",
  isProd:
    typeof importMetaEnv.PROD === "boolean"
      ? Boolean(importMetaEnv.PROD)
      : String(processEnv.NODE_ENV || "").trim().toLowerCase() === "production",
  isTest:
    String(processEnv.NODE_ENV || "").trim().toLowerCase() === "test" ||
    String(processEnv.PLAYWRIGHT_PROFILE || "").trim().toLowerCase() === "static",
  apiBaseUrl: importMetaEnv.VITE_API_BASE_URL || processEnv.VITE_API_BASE_URL || "",
  hostname: runtimeLocation?.hostname ?? (fallbackUiOrigin ? new URL(fallbackUiOrigin).hostname : ""),
  origin: runtimeLocation?.origin ?? fallbackUiOrigin,
});
