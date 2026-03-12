import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { resolveApiBase } from "../src/config/apiBaseResolver.ts";

const args = process.argv.slice(2);
const forceProduction =
  args.includes("--production") || args.includes("--mode=production");

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, "..");
const envFiles = forceProduction
  ? [".env.production", ".env"]
  : [".env.ui.local", ".env.local", ".env.development", ".env"];

const loadedFiles: string[] = [];
for (const fileName of envFiles) {
  const fullPath = path.join(repoRoot, fileName);
  if (!fs.existsSync(fullPath)) continue;
  dotenv.config({ path: fullPath, override: false, quiet: true });
  loadedFiles.push(fileName);
}

const mode = forceProduction ? "production" : "development";
const hostname = forceProduction
  ? String(process.env.PROD_CONFIG_HOSTNAME || "officialmerch.tech").trim()
  : "localhost";

try {
  const apiBaseUrl = resolveApiBase({
    mode,
    hostname,
    backendBaseUrl: process.env.VITE_BACKEND_BASE_URL,
    apiBaseProd: process.env.VITE_API_BASE_PROD,
    apiBaseProdCompat: process.env.VITE_PROD_API_BASE_URL,
    apiBaseDev: process.env.VITE_API_BASE_DEV,
    apiBaseLegacy: process.env.VITE_API_BASE_URL,
  });

  console.log("[env:check] ok", {
    mode,
    hostname,
    apiBaseUrl,
    loadedFiles,
  });
} catch (error: any) {
  console.error("[env:check] invalid frontend environment contract");
  console.error(`  1. ${String(error?.message || error || "unknown_error")}`);
  process.exit(1);
}
