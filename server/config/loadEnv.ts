import dotenv from "dotenv";
import path from "node:path";

/**
 * Load environment-specific .env files.
 *
 * Resolution order (later files win):
 *   1. `<root>/.env` (legacy/shared fallback, optional)
 *   2. `<root>/.env.<NODE_ENV>` (e.g. .env.development, .env.staging, .env.production)
 *
 * Real environment variables (injected by the host/CI) always win over
 * file values, except the env-specific file overrides the base file.
 *
 * Defaults NODE_ENV to "development" when unset so `npm run dev`
 * picks up `.env.development` without extra flags.
 */
const projectRoot = process.cwd();

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const nodeEnv = process.env.NODE_ENV;

dotenv.config({ path: path.resolve(projectRoot, ".env") });

dotenv.config({
  path: path.resolve(projectRoot, `.env.${nodeEnv}`),
  override: true,
});
