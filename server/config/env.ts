import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().default("poolside/laguna-s-2.1:free"),
  OPENROUTER_CONTEXT_SUMMARY_MODEL: z
    .string()
    .default("nvidia/nemotron-3.5-lightning:free"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
});

export const env = envSchema.parse(process.env);
