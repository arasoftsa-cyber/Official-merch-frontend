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
