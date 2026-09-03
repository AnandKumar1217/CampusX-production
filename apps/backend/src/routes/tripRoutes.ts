import { Router } from "express";
import { z } from "zod";

import { Notification } from "../models/Social.js";
import {
  Trip,
  TripExpense,
  TripItinerary,
  TripMember,
  TripVote,
} from "../models/Trip.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";

export const tripRouter = Router();

tripRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const memberships = await TripMember.find({
      user: request.user!._id,
      status: "accepted",
    }).select("trip");
    const tripIds = memberships.map((item) => item.trip);
    const items = await Trip.find({
      $or: [{ createdBy: request.user!._id }, { _id: { $in: tripIds } }],
    })
      .sort({ startDate: 1 })
      .populate("createdBy", "name username avatarUrl");
    return sendSuccess(response, items);
  }),
);

tripRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(3).max(180).optional(),
        destination: z.string().min(2).max(180),
        imageUrl: z.url().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        budget: z.number().min(0).optional(),
        transport: z.string().max(200).optional(),
        stay: z.string().max(200).optional(),
        interests: z.union([z.array(z.string()), z.string()]).optional(),
        draft: z.boolean().default(false),
      })
      .parse(request.body);
    const trip = await Trip.create({
      title: input.title ?? `${input.destination} Trip`,
      destination: input.destination,
      imageUrl: input.imageUrl,
      startDate: input.startDate,
      endDate: input.endDate,
      budgetPerPerson: input.budget,
      transport: input.transport,
      stay: input.stay,
      interests:
        typeof input.interests === "string"
          ? input.interests.split(",").map((item) => item.trim())
          : input.interests,
      status: input.draft ? "draft" : "upcoming",
      createdBy: request.user!._id,
    });
    await TripMember.create({
      trip: trip._id,
      user: request.user!._id,
      role: "organizer",
      status: "accepted",
    });
    return sendSuccess(response, trip, "Trip created", 201);
  }),
);

tripRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const [trip, members, itinerary, votes, expenses] = await Promise.all([
      Trip.findById(request.params.id).populate(
        "createdBy",
        "name username avatarUrl",
      ),
      TripMember.find({ trip: request.params.id }).populate(
        "user",
        "name username avatarUrl",
      ),
      TripItinerary.find({ trip: request.params.id }).sort({
        day: 1,
        position: 1,
      }),
      TripVote.find({ trip: request.params.id }),
      TripExpense.find({ trip: request.params.id }).populate(
        "paidBy splitAmong",
        "name username avatarUrl",
      ),
    ]);
    if (!trip) throw new AppError(404, "Trip not found", "TRIP_NOT_FOUND");
    return sendSuccess(response, { trip, members, itinerary, votes, expenses });
  }),
);

tripRouter.post(
  "/:id/invites",
  asyncHandler(async (request, response) => {
    const { userIds } = z
      .object({ userIds: z.array(z.string()).min(1).max(50) })
      .parse(request.body);
    const trip = await Trip.findOne({
      _id: request.params.id,
      createdBy: request.user!._id,
    });
    if (!trip)
      throw new AppError(
        403,
        "Only the organizer can invite members",
        "FORBIDDEN",
      );
    await Promise.all(
      userIds.map((userId) =>
        TripMember.updateOne(
          { trip: trip._id, user: userId },
          {
            $setOnInsert: {
              trip: trip._id,
              user: userId,
              role: "member",
              status: "invited",
            },
          },
          { upsert: true },
        ),
      ),
    );
    await Notification.insertMany(
      userIds.map((userId) => ({
        user: userId,
        actor: request.user!._id,
        type: "trip_invite",
        title: `${request.user!.name} invited you to ${trip.title}`,
        target: { route: "TripDetails", params: { tripId: trip._id } },
      })),
    );
    return sendSuccess(
      response,
      { invited: userIds.length },
      "Invitations sent",
    );
  }),
);

tripRouter.put(
  "/:id/itinerary",
  asyncHandler(async (request, response) => {
    const items = z
      .array(
        z.object({
          day: z.number().int().min(1),
          startsAt: z.string().max(20).optional(),
          title: z.string().min(1).max(180),
          location: z.string().max(200).optional(),
          notes: z.string().max(1000).optional(),
          position: z.number().int().min(0),
        }),
      )
      .max(100)
      .parse(request.body.items);
    const trip = await Trip.findOne({
      _id: request.params.id,
      createdBy: request.user!._id,
    });
    if (!trip)
      throw new AppError(
        403,
        "Only the organizer can edit the itinerary",
        "FORBIDDEN",
      );
    await TripItinerary.deleteMany({ trip: trip._id });
    const created = await TripItinerary.insertMany(
      items.map((item) => ({ ...item, trip: trip._id })),
    );
    return sendSuccess(response, created, "Itinerary updated");
  }),
);

tripRouter.post(
  "/:id/votes",
  asyncHandler(async (request, response) => {
    const { pollId, option } = z
      .object({
        pollId: z.string().optional(),
        option: z.number().int().min(0),
      })
      .parse(request.body);
    const vote = pollId
      ? await TripVote.findOne({ _id: pollId, trip: request.params.id })
      : await TripVote.findOne({ trip: request.params.id });
    if (!vote || !vote.options[option])
      throw new AppError(404, "Trip vote not found", "VOTE_NOT_FOUND");
    vote.options.forEach((item) => {
      item.voters = item.voters.filter(
        (id) => id.toString() !== request.user!._id.toString(),
      );
    });
    vote.options[option].voters.push(request.user!._id);
    await vote.save();
    request.app
      .get("io")
      ?.to(`trip:${request.params.id}`)
      .emit("trip:update", { type: "vote", vote });
    return sendSuccess(response, vote, "Vote recorded");
  }),
);

tripRouter.post(
  "/:id/expenses",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(1).max(180),
        amount: z.number().positive(),
        paidBy: z.string().optional(),
        splitAmong: z.array(z.string()).min(1),
      })
      .parse(request.body);
    const share =
      Math.round((input.amount / input.splitAmong.length) * 100) / 100;
    const item = await TripExpense.create({
      ...input,
      trip: request.params.id,
      paidBy: input.paidBy ?? request.user!._id,
      shares: input.splitAmong.map((user) => ({ user, amount: share })),
    });
    request.app
      .get("io")
      ?.to(`trip:${request.params.id}`)
      .emit("trip:update", { type: "expense", expense: item });
    return sendSuccess(response, item, "Expense added", 201);
  }),
);
tripRouter.post(
  "/:id/expenses/settle",
  asyncHandler(async (request, response) => {
    const { amount } = z
      .object({ amount: z.number().min(0) })
      .parse(request.body);
    return sendSuccess(
      response,
      { amount, status: "recorded" },
      "Settlement recorded",
    );
  }),
);
