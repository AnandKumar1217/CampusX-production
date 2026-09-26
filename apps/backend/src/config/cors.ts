import type { CorsOptions } from "cors";

import { AppError } from "../utils/http.js";
import { env } from "./env.js";

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[] = env.corsOrigins,
) {
  // Native React Native clients do not send a browser Origin header.
  return origin === undefined || allowedOrigins.includes(origin);
}

export function createCorsOptions(
  allowedOrigins: readonly string[] = env.corsOrigins,
): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError(403, "Origin not allowed by CORS", "CORS_ORIGIN_DENIED"),
      );
    },
    credentials: true,
  };
}

export const corsOptions = createCorsOptions();
