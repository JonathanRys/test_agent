import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().default("poolside/laguna-s-2.1:free"),
  OPENROUTER_CONTEXT_SUMMARY_MODEL: z
    .string()
    .default("nvidia/nemotron-3.5-lightning:free"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  // Optional comma-separated fallback models tried in order after the primary
  // model exhausts its 429 retry budget (e.g. another free model on a
  // different shared pool). Empty by default = retry primary only.
  OPENROUTER_FALLBACK_MODELS: z.string().optional(),
  // Keyless forecast provider (Open-Meteo by default). Overridable so the
  // weather injection can be pointed at a self-hosted or cached instance.
  WEATHER_API_BASE_URL: z
    .string()
    .default("https://api.open-meteo.com/v1/forecast"),
  REDIS_URL: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
