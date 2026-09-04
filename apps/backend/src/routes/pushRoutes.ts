import { Router } from "express";
import { z } from "zod";
import { PushDevice } from "../models/PushDevice.js";
import { asyncHandler, sendSuccess } from "../utils/http.js";

export const pushRouter = Router();

pushRouter.post(
  "/register",
  asyncHandler(async (request, response) => {
    const { token, deviceId, platform } = z
      .object({
        token: z.string(),
        deviceId: z.string().optional(),
        platform: z.string().optional(),
      })
      .parse(request.body);

    await PushDevice.findOneAndUpdate(
      { expoPushToken: token },
      {
        $set: {
          user: request.user!._id,
          deviceId,
          platform,
          active: true,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return sendSuccess(response, null, "Push token registered successfully");
  })
);

pushRouter.post(
  "/unregister",
  asyncHandler(async (request, response) => {
    const { token } = z
      .object({
        token: z.string(),
      })
      .parse(request.body);

    await PushDevice.findOneAndUpdate(
      { expoPushToken: token, user: request.user!._id },
      { $set: { active: false } }
    );

    return sendSuccess(response, null, "Push token unregistered successfully");
  })
);
