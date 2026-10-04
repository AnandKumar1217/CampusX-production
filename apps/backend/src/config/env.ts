import "dotenv/config";

import { z } from "zod";

const DEFAULT_ACCESS_SECRET = "development-access-secret-change-me";
const DEFAULT_REFRESH_SECRET = "development-refresh-secret-change-me";

function isPrivateHostname(rawHostname: string) {
  const hostname = rawHostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "::1" ||
    (hostname.includes(":") && /^(?:f[cd]|fe[89ab])/.test(hostname)) ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    return true;
  }

  const match172 = hostname.match(/^172\.(\d{1,3})\./);
  return Boolean(
    match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31,
  );
}

function getMongoHosts(uri: string) {
  const prefix = uri.match(/^mongodb(?:\+srv)?:\/\//i)?.[0];
  if (!prefix) return [];

  const authority = uri.slice(prefix.length).split(/[/?#]/, 1)[0] ?? "";
  const hosts = authority.slice(authority.lastIndexOf("@") + 1);
  return hosts
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith("[")) {
        const closingBracket = entry.indexOf("]");
        return closingBracket >= 0 ? entry.slice(1, closingBracket) : entry;
      }
      return entry.split(":", 1)[0] ?? "";
    })
    .filter(Boolean);
}

function isPlaceholderSecret(secret: string, defaultValue: string) {
  const normalized = secret.trim().toLowerCase();
  return (
    secret === defaultValue ||
    /(?:change[-_ ]?me|replace[-_ ]?with|placeholder|development|example|dummy|your[-_ ]?(?:jwt[-_ ]?)?(?:access[-_ ]?|refresh[-_ ]?)?secret|jwt[-_ ]?secret)/i.test(
      normalized,
    ) || /^(.)\1+$/.test(normalized)
  );
}

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(16).default(DEFAULT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: z.string().min(16).default(DEFAULT_REFRESH_SECRET),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGINS: z
      .string()
      .default(""),
    PASSWORD_RESET_URL: z.string().default("campusx://reset-password"),
    AI_PROVIDER: z
      .enum(["disabled", "openai-compatible", "multi"])
      .default("disabled"),
    AI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default("llama3-8b-8192"),
    OPENROUTER_MODEL: z.string().default("openrouter/free"),
    ORS_API_KEY: z.string().optional(),
    OPENROUTER_VISION_MODEL: z.string().optional(),
    AI_PROVIDER_ORDER: z.string().default("groq,openrouter"),
    AI_FORCE_FAIL_PROVIDER: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    GOOGLE_CLOUD_VISION_API_KEY: z.string().optional(),
    TIMETABLE_ENHANCED_IMPORT: z.enum(["true", "false"]).default("true").transform((val) => val === "true"),
    ACTIVITY_UPDATE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") return;

    const mongoHosts = getMongoHosts(value.MONGODB_URI);
    if (
      mongoHosts.length === 0 ||
      mongoHosts.some(isPrivateHostname)
    ) {
      context.addIssue({
        code: "custom",
        path: ["MONGODB_URI"],
        message: "Production requires a non-local MongoDB URI",
      });
    }

    const secrets = [
      ["JWT_ACCESS_SECRET", value.JWT_ACCESS_SECRET, DEFAULT_ACCESS_SECRET],
      ["JWT_REFRESH_SECRET", value.JWT_REFRESH_SECRET, DEFAULT_REFRESH_SECRET],
    ] as const;
    for (const [name, secret, defaultValue] of secrets) {
      if (secret.length < 32 || isPlaceholderSecret(secret, defaultValue)) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: "Production requires a non-placeholder secret of at least 32 characters",
        });
      }
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Access and refresh token secrets must be different",
      });
    }

    const origins = value.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    for (const origin of origins) {
      try {
        const url = new URL(origin);
        if (url.protocol !== "https:" || isPrivateHostname(url.hostname)) {
          throw new Error("Origin is not public HTTPS");
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["CORS_ORIGINS"],
          message: `Production CORS origin must be public HTTPS: ${origin}`,
        });
      }
    }

    for (const name of [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ] as const) {
      if (!value[name]?.trim()) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: "Production uploads require Cloudinary configuration",
        });
      }
    }
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

