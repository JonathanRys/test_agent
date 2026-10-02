import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["local", "development", "staging", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().default("poolside/laguna-s-2.1:free"),
  OPENROUTER_CONTEXT_SUMMARY_MODEL: z
    .string()
    .default("nvidia/nemotron-3.5-lightning:free"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  // Comma-separated fallback models tried in order after the primary model
  // exhausts its 429 retry budget. Deployments can override this list.
  OPENROUTER_FALLBACK_MODELS: z
    .string()
    .default(
      "nvidia/nemotron-3.5-lightning:free,qwen/qwen3.8-27b:free,nvidia/nemotron-3-ultra-550b-a55b:free",
    ),
  // Keyless forecast provider (Open-Meteo by default). Overridable so the
  // weather injection can be pointed at a self-hosted or cached instance.
  WEATHER_API_BASE_URL: z
    .string()
    .default("https://api.open-meteo.com/v1/forecast"),
  // OSRM-compatible table endpoint. Use a self-hosted/provider endpoint for
  // production; the public OSRM demo is intended for light development use.
  ROUTING_API_BASE_URL: z
    .string()
    .default("https://router.project-osrm.org/table/v1/driving"),
  REDIS_URL: z.string().min(1).optional(),
  ADMIN_USERS: z.string().default(""),
});

export const env = envSchema.parse(process.env);
