import "dotenv/config";

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/campusx"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default("development-access-secret-change-me"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default("development-refresh-secret-change-me"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:8081,http://localhost:19006"),
  PASSWORD_RESET_URL: z.string().default("campusx://reset-password"),
  AI_PROVIDER: z.enum(["disabled", "openai-compatible"]).default("disabled"),
  AI_API_KEY: z.string().optional(),
  WEATHER_API_KEY: z.string().optional(),
  UPLOAD_DIRECTORY: z.string().default("uploads"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
