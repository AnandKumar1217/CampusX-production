import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";

import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./routes/authRoutes.js";
import { calendarRouter } from "./routes/calendarRoutes.js";
import { holidayRouter } from "./routes/holidayRoutes.js";
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
import { timetableScheduleRouter } from "./routes/timetableScheduleRoutes.js";
import { timetableAnalysisRouter } from "./routes/timetableAnalysisRoutes.js";
import { uploadRouter } from "./routes/uploadRoutes.js";
import { pushRouter } from "./routes/pushRoutes.js";
import { userRouter } from "./routes/userRoutes.js";
import { mapRouter } from "./routes/mapRoutes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "2mb" }));
  if (env.NODE_ENV !== "test")
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.get("/api/health", (_request, response) => {
    const databaseReady = mongoose.connection.readyState === 1;
    return response.status(databaseReady ? 200 : 503).json({
      success: databaseReady,
      data: {
        status: databaseReady ? "ok" : "degraded",
        service: "campusx-api",
        database: databaseReady ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
      },
      message: databaseReady ? "Service is healthy" : "Service is not ready",
    });
  });

  app.get("/events/:id", (req, res) => {
    const installUrl = env.CAMPUSX_INSTALL_URL || "https://expo.dev";
    const appScheme = `campusx://event/${req.params.id}`;
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CampusX Event</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #f9fafb; color: #1f2937; }
            .btn { display: inline-block; margin: 12px; padding: 14px 24px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; }
            .btn-primary { background: #7c3aed; color: #fff; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3); }
            .btn-secondary { background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; }
          </style>
          <script>
            window.onload = function() {
              window.location.href = "${appScheme}";
            };
          </script>
        </head>
        <body>
          <h2 style="margin-bottom: 24px; font-size: 24px;">Open this event in CampusX</h2>
          <a href="${appScheme}" class="btn btn-primary">Open in CampusX App</a>
          <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin-bottom: 16px;">Don't have the app yet?</p>
            <a href="${installUrl}" class="btn btn-secondary">Install CampusX</a>
          </div>
        </body>
      </html>
    `);
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", authenticate, userRouter);
  app.use("/api/friends", authenticate, friendRouter);
  app.use("/api/posts", authenticate, postRouter);
  app.use("/api/chats", authenticate, chatRouter);
  app.use("/api/groups", authenticate, groupRouter);
  app.use("/api/events", authenticate, eventRouter);
  app.use("/api/marketplace", authenticate, marketplaceRouter);
  app.use("/api/timetable", authenticate, timetableRouter);
  app.use("/api/timetable", authenticate, timetableScheduleRouter);
  app.use("/api/timetable", authenticate, timetableAnalysisRouter);
  app.use("/api/calendar", authenticate, calendarRouter);
  app.use("/api/holidays", authenticate, holidayRouter);
  app.use("/api/trips", authenticate, tripRouter);
  app.use("/api/notifications", authenticate, notificationRouter);
  app.use("/api/location", authenticate, locationRouter);
  app.use("/api/ai", authenticate, aiRouter);
  app.use("/api/weather", authenticate, weatherRouter);
  app.use("/api/upload", authenticate, uploadRouter);
  app.use("/api/push", authenticate, pushRouter);
  app.use("/api/maps", authenticate, mapRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
