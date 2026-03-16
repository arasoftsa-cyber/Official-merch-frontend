import { resolveApiBase } from "./apiBaseResolver";

const importMetaEnv: Record<string, any> =
  typeof import.meta !== "undefined" && (import.meta as any)?.env
    ? (import.meta as any).env
    : {};

const runtimeLocation =
  typeof window !== "undefined" && window?.location ? window.location : null;

export default resolveApiBase({
  mode: importMetaEnv.MODE,
  isDev: Boolean(importMetaEnv.DEV),
  isProd: Boolean(importMetaEnv.PROD),
  apiBaseUrl: importMetaEnv.VITE_API_BASE_URL,
  hostname: runtimeLocation?.hostname ?? "",
  origin: runtimeLocation?.origin ?? "",
});
