import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./routes/authRoutes.js";
import { chatRouter } from "./routes/chatRoutes.js";
import {
  eventRouter,
  marketplaceRouter,
  timetableRouter,
} from "./routes/commerceRoutes.js";
import { friendRouter } from "./routes/friendRoutes.js";
import { groupRouter } from "./routes/groupRoutes.js";
import { postRouter } from "./routes/postRoutes.js";
import {
  aiRouter,
  locationRouter,
  notificationRouter,
  weatherRouter,
} from "./routes/systemRoutes.js";
import { tripRouter } from "./routes/tripRoutes.js";
import { userRouter } from "./routes/userRoutes.js";
import { sendSuccess } from "./utils/http.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) callback(null, true);
        else callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "2mb" }));
  if (env.NODE_ENV !== "test")
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.get("/api/health", (_request, response) =>
    sendSuccess(response, {
      status: "ok",
      service: "campusx-api",
      timestamp: new Date().toISOString(),
    }),
  );
  app.use("/api/auth", authRouter);
  app.use("/api/users", authenticate, userRouter);
  app.use("/api/friends", authenticate, friendRouter);
  app.use("/api/posts", authenticate, postRouter);
  app.use("/api/chats", authenticate, chatRouter);
  app.use("/api/groups", authenticate, groupRouter);
  app.use("/api/events", authenticate, eventRouter);
  app.use("/api/marketplace", authenticate, marketplaceRouter);
  app.use("/api/timetable", authenticate, timetableRouter);
  app.use("/api/trips", authenticate, tripRouter);
  app.use("/api/notifications", authenticate, notificationRouter);
  app.use("/api/location", authenticate, locationRouter);
  app.use("/api/ai", authenticate, aiRouter);
  app.use("/api/weather", authenticate, weatherRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
