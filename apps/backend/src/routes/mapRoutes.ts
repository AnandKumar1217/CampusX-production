import { Router, Request, Response } from "express";
import axios from "axios";
import { z } from "zod";
import { env } from "../config/env.js";
import { sendSuccess } from "../utils/http.js";

const sendError = (res: Response, message: string, statusCode = 500) => {
  return res.status(statusCode).json({ success: false, error: { message, code: "MAP_ERROR" } });
};

export const mapRouter = Router();

const directionsSchema = z.object({
  startLng: z.coerce.number(),
  startLat: z.coerce.number(),
  endLng: z.coerce.number(),
  endLat: z.coerce.number(),
  mode: z.enum(["driving", "walking", "cycling"]).default("driving"),
});

mapRouter.get("/directions", async (req: Request, res: Response) => {
  try {
    const parsed = directionsSchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, "Invalid directions parameters", 400);
    }

    const { startLng, startLat, endLng, endLat, mode } = parsed.data;

    let profile = "driving-car";
    if (mode === "walking") profile = "foot-walking";
    if (mode === "cycling") profile = "cycling-regular";

    if (!env.ORS_API_KEY) {
      return sendError(res, "Routing service is currently unavailable", 503);
    }

    const url = `https://api.heigit.org/v2/directions/${profile}?start=${startLng},${startLat}&end=${endLng},${endLat}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: env.ORS_API_KEY,
        Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
      },
      timeout: 10000,
    });

    const data = response.data;
    if (!data.features || data.features.length === 0) {
      return sendError(res, "No route found", 404);
    }

    const route = data.features[0];
    const geometry = route.geometry;
    const summary = route.properties?.summary || {};
    const segments = route.properties?.segments || [];
    const steps = segments.length > 0 ? segments[0].steps : [];

    return sendSuccess(res, {
      geometry,
      distanceMeters: summary.distance || 0,
      durationSeconds: summary.duration || 0,
      steps,
    });
  } catch (error: any) {
    console.error("Directions API Error:", error.response?.data || error.message);
    return sendError(res, "Failed to calculate route", 500);
  }
});
