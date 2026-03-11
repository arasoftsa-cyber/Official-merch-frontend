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
