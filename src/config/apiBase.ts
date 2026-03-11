const mode = String(import.meta.env.MODE || "").trim().toLowerCase();
const expectedEnv =
  mode === "production" ? "VITE_API_BASE_PROD" : "VITE_API_BASE_DEV";
const modeValue =
  mode === "production"
    ? import.meta.env.VITE_API_BASE_PROD
    : import.meta.env.VITE_API_BASE_DEV;
const legacyValue = import.meta.env.VITE_API_BASE_URL;
const resolved = String(modeValue || legacyValue || "").trim();

if (!resolved) {
  throw new Error(
    `[config] Missing API base URL. Set ${expectedEnv} (or VITE_API_BASE_URL as compatibility fallback).`
  );
}

export default resolved.replace(/\/+$/, "");
import { resolveApiBase } from "./apiBaseResolver";

const importMetaEnv: Record<string, any> =
  typeof import.meta !== "undefined" && (import.meta as any)?.env
    ? (import.meta as any).env
    : {};

const runtimeHostname =
  typeof window !== "undefined" && window?.location?.hostname
    ? window.location.hostname
    : "";

export default resolveApiBase({
  mode: importMetaEnv.MODE,
  apiBaseProd: importMetaEnv.VITE_API_BASE_PROD,
  apiBaseProdCompat: importMetaEnv.VITE_PROD_API_BASE_URL,
  apiBaseDev: importMetaEnv.VITE_API_BASE_DEV,
  apiBaseLegacy: importMetaEnv.VITE_API_BASE_URL,
  hostname: runtimeHostname,
});
