import { Router } from "express";
import type { Request } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { Notification, Friendship } from "../models/Social.js";
import {
  Trip,
  TripExpense,
  TripItinerary,
  TripMember,
  TripVote,
} from "../models/Trip.js";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { emitNotificationChanged } from "../utils/notificationEvents.js";

export const tripRouter = Router();

async function requireTripAccess(tripId: string, userId: string) {
  if (!isValidObjectId(tripId)) throw new AppError(400, "Invalid trip id", "INVALID_ID");
  const trip = await Trip.findById(tripId);
  if (!trip) throw new AppError(404, "Trip not found", "TRIP_NOT_FOUND");
  const member = await TripMember.exists({
    trip: trip._id,
    user: userId,
    status: { $in: ["invited", "accepted"] },
  });
  if (!member && trip.createdBy.toString() !== userId)
    throw new AppError(403, "Not authorized to access this trip", "FORBIDDEN");
  return trip;
}

async function requireTripParticipant(tripId: string, userId: string) {
  const trip = await requireTripAccess(tripId, userId);
  if (trip.createdBy.toString() === userId) return trip;
  const accepted = await TripMember.exists({ trip: tripId, user: userId, status: "accepted" });
  if (!accepted) throw new AppError(403, "Join this trip before participating", "FORBIDDEN");
  return trip;
}

async function emitTripEvent(request: Request, tripId: string, event: string, payload: object) {
  const members = await TripMember.find({
    trip: tripId,
    status: { $in: ["invited", "accepted"] },
  }).select("user");
  const recipients = new Set(members.map((member) => member.user.toString()));
  recipients.add(request.user!._id.toString());
  const io = request.app.get("io");
  recipients.forEach((id) => io?.to(`user:${id}`).emit(event, payload));
}

function evictTripSockets(request: Request, tripId: string, userId: string) {
  request.app.get("io")?.in(`user:${userId}`).socketsLeave(`trip:${tripId}`);
}

tripRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const memberships = await TripMember.find({
      user: request.user!._id,
      status: { $in: ["accepted", "invited", "organizer"] },
    }).select("trip status role");
    const tripIds = memberships.map((item) => item.trip);
    const items = await Trip.find({
      $or: [{ createdBy: request.user!._id }, { _id: { $in: tripIds } }],
    })
      .sort({ startDate: 1 })
      .populate("createdBy", "name username avatarUrl")
      .lean();
      
    const enriched = items.map(trip => {
      const mem = memberships.find(m => m.trip.toString() === trip._id.toString());
      return {
         ...trip,
         myStatus: mem?.status || (trip.createdBy.toString() === request.user!._id.toString() ? 'accepted' : 'unknown')
      };
    });
      
    return sendSuccess(response, enriched);
  }),
);

tripRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(1).max(180),
        description: z.string().max(1000).optional(),
        destination: z.string().min(1).max(180),
        destinationName: z.string().optional(),
        destinationAddress: z.string().optional(),
        destinationLat: z.number().optional(),
        destinationLng: z.number().optional(),
        placeId: z.string().optional(),
        imageUrl: z.string().url().optional(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional(),
        meetingPoint: z.string().max(200).optional(),
        departureTime: z.string().max(50).optional(),
        tripType: z.enum(["Day Trip", "Overnight", "Multi-day"]).optional(),
        budget: z.number().min(0).optional(),
        transport: z.string().max(200).optional(),
        stay: z.string().max(200).optional(),
      })
      .parse(request.body);
      
    if (input.endDate && input.endDate < input.startDate) {
      throw new AppError(400, "End date cannot be before start date", "INVALID_DATES");
    }

    const trip = await Trip.create({
      title: input.title,
      description: input.description,
      destination: input.destination,
      destinationName: input.destinationName,
      destinationAddress: input.destinationAddress,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      placeId: input.placeId,
      imageUrl: input.imageUrl,
      startDate: input.startDate,
      endDate: input.endDate,
      meetingPoint: input.meetingPoint,
      departureTime: input.departureTime,
      tripType: input.tripType,
      budgetPerPerson: input.budget,
      transport: input.transport,
      stay: input.stay,
      status: "upcoming",
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
    await requireTripAccess(String(request.params.id), request.user!._id.toString());

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

tripRouter.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(1).max(180).optional(),
        description: z.string().max(1000).optional(),
        destination: z.string().min(1).max(180).optional(),
        destinationName: z.string().optional(),
        destinationAddress: z.string().optional(),
        destinationLat: z.number().optional(),
        destinationLng: z.number().optional(),
        placeId: z.string().optional(),
        imageUrl: z.string().url().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        meetingPoint: z.string().max(200).optional(),
        departureTime: z.string().max(50).optional(),
        tripType: z.enum(["Day Trip", "Overnight", "Multi-day"]).optional(),
        budgetPerPerson: z.number().min(0).optional(),
        transport: z.string().max(200).optional(),
      })
      .parse(request.body);

    const trip = await Trip.findOne({
      _id: request.params.id,
      createdBy: request.user!._id,
    });
    if (!trip) throw new AppError(403, "Only the organizer can edit the trip", "FORBIDDEN");

    Object.assign(trip, input);
    await trip.save();

    const recipients = (await TripMember.find({
      trip: trip._id,
      status: { $in: ["invited", "accepted"] },
      user: { $ne: request.user!._id },
    }).select("user")).map((member) => member.user.toString());
    if (recipients.length) {
      await Notification.insertMany(recipients.map((id) => ({
        user: id,
        actor: request.user!._id,
        type: "trip_update",
        title: `Trip updated: ${trip.title}`,
        target: { route: "TripDetails", params: { tripId: trip._id.toString() } },
      })));
      emitNotificationChanged(request, recipients);
    }

    await emitTripEvent(request, trip._id.toString(), "trip:updated", { tripId: trip._id });
    return sendSuccess(response, trip, "Trip updated");
  }),
);

tripRouter.post(
  "/:id/cancel",
  asyncHandler(async (request, response) => {
    const trip = await Trip.findOne({ _id: request.params.id, createdBy: request.user!._id });
    if (!trip) throw new AppError(403, "Only the organizer can cancel the trip", "FORBIDDEN");

    trip.status = "cancelled";
    await trip.save();

    const recipients = (await TripMember.find({
      trip: trip._id,
      status: { $in: ["invited", "accepted"] },
      user: { $ne: request.user!._id },
    }).select("user")).map((member) => member.user.toString());
    if (recipients.length) {
      await Notification.insertMany(recipients.map((id) => ({
        user: id,
        actor: request.user!._id,
        type: "trip_cancelled",
        title: `Trip cancelled: ${trip.title}`,
        target: { route: "TripDetails", params: { tripId: trip._id.toString() } },
      })));
      emitNotificationChanged(request, recipients);
    }

    await emitTripEvent(request, trip._id.toString(), "trip:cancelled", { tripId: trip._id });
    return sendSuccess(response, null, "Trip cancelled");
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
    if (trip.status === "cancelled") throw new AppError(409, "Cancelled trips cannot accept invites", "TRIP_CANCELLED");
      
    const validUsers = [];
    for (const userId of userIds) {
      if (!isValidObjectId(userId) || userId === request.user!._id.toString()) continue;
      const friendship = await Friendship.findOne({ users: { $all: [request.user!._id, userId] } });
      if (friendship) {
        validUsers.push(userId);
      }
    }

    if (validUsers.length === 0) {
      return sendSuccess(response, { invited: 0 }, "No valid friends to invite");
    }

    await Promise.all(
      validUsers.map((userId) =>
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
        )
      ),
    );
    
    const notifications = validUsers.map((userId) => ({
      user: userId,
      actor: request.user!._id,
      type: "trip_invite",
      title: `${request.user!.name} invited you to ${trip.title}`,
      target: { route: "TripDetails", params: { tripId: trip._id } },
    }));
    await Notification.insertMany(notifications);
    emitNotificationChanged(request, validUsers);
    
    validUsers.forEach(userId => {
      request.app.get("io")?.to(`user:${userId}`).emit("trip:invite", { tripId: trip._id });
    });
    await emitTripEvent(request, trip._id.toString(), "trip:updated", { tripId: trip._id });

    return sendSuccess(
      response,
      { invited: validUsers.length },
      "Invitations sent",
    );
  }),
);

tripRouter.post(
  "/:id/rsvp",
  asyncHandler(async (request, response) => {
    const { status } = z
      .object({ status: z.enum(["accepted", "declined"]) })
      .parse(request.body);

    const member = await TripMember.findOne({ trip: request.params.id, user: request.user!._id });
    if (!member) throw new AppError(404, "Invitation not found", "NOT_FOUND");
    
    const trip = await Trip.findById(request.params.id);
    if (!trip) throw new AppError(404, "Trip not found", "NOT_FOUND");
    if (trip.status === "cancelled") throw new AppError(409, "Cancelled trips cannot be joined", "TRIP_CANCELLED");
    
    if (member.role === "organizer") {
       throw new AppError(403, "Organizer cannot RSVP", "FORBIDDEN");
    }

    const previousStatus = member.status;
    member.status = status;
    await member.save();
    if (status === "declined") evictTripSockets(request, trip._id.toString(), request.user!._id.toString());

    if (status === "accepted" && previousStatus !== "accepted") {
      await Notification.create({
        user: trip.createdBy,
        actor: request.user!._id,
        type: "trip_joined",
        title: `${request.user!.name} joined ${trip.title}`,
        target: { route: "TripDetails", params: { tripId: trip._id.toString() } },
      });
      emitNotificationChanged(request, [trip.createdBy.toString()]);
    }

    await emitTripEvent(request, trip._id.toString(), "trip:rsvp", { tripId: trip._id, userId: request.user!._id, status });
    await emitTripEvent(request, trip._id.toString(), "trip:updated", { tripId: trip._id });

    return sendSuccess(response, member, `RSVP ${status}`);
  }),
);

tripRouter.delete(
  "/:id/leave",
  asyncHandler(async (request, response) => {
    const member = await TripMember.findOne({ trip: request.params.id, user: request.user!._id });
    if (!member) throw new AppError(404, "Member not found", "NOT_FOUND");
    if (member.role === "organizer") throw new AppError(403, "Organizer cannot leave trip", "FORBIDDEN");

    await member.deleteOne();
    evictTripSockets(request, String(request.params.id), request.user!._id.toString());
    
    await emitTripEvent(request, String(request.params.id), "trip:memberRemoved", { tripId: request.params.id, userId: request.user!._id });
    await emitTripEvent(request, String(request.params.id), "trip:updated", { tripId: request.params.id });
    
    return sendSuccess(response, null, "Left trip successfully");
  }),
);

tripRouter.delete(
  "/:id/members/:userId",
  asyncHandler(async (request, response) => {
    const trip = await Trip.findOne({ _id: request.params.id, createdBy: request.user!._id });
    if (!trip) throw new AppError(403, "Only organizer can remove members", "FORBIDDEN");
    
    if (request.params.userId === request.user!._id.toString()) {
       throw new AppError(400, "Cannot remove yourself", "BAD_REQUEST");
    }

    const member = await TripMember.findOne({ trip: trip._id, user: request.params.userId });
    if (member) {
      await member.deleteOne();
      evictTripSockets(request, trip._id.toString(), String(request.params.userId));
      request.app.get("io")?.to(`user:${request.params.userId}`).emit("trip:memberRemoved", { tripId: trip._id, userId: request.params.userId });
      await emitTripEvent(request, trip._id.toString(), "trip:memberRemoved", { tripId: trip._id, userId: request.params.userId });
      await emitTripEvent(request, trip._id.toString(), "trip:updated", { tripId: trip._id });
    }

    return sendSuccess(response, null, "Member removed");
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
    await emitTripEvent(request, trip._id.toString(), "trip:updated", { tripId: trip._id });
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
    await requireTripParticipant(String(request.params.id), request.user!._id.toString());
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
    await emitTripEvent(request, String(request.params.id), "trip:update", { tripId: request.params.id, type: "vote", vote });
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
    await requireTripParticipant(String(request.params.id), request.user!._id.toString());
    const participants = await TripMember.find({ trip: request.params.id, status: "accepted" }).select("user");
    const participantIds = new Set(participants.map((member) => member.user.toString()));
    if (!input.splitAmong.every((id) => isValidObjectId(id) && participantIds.has(id)))
      throw new AppError(400, "Expenses can only be split among trip participants", "INVALID_PARTICIPANTS");
    const share =
      Math.round((input.amount / input.splitAmong.length) * 100) / 100;
    const item = await TripExpense.create({
      ...input,
      trip: request.params.id,
      paidBy: request.user!._id,
      shares: input.splitAmong.map((user) => ({ user, amount: share })),
    });
    await emitTripEvent(request, String(request.params.id), "trip:update", { tripId: request.params.id, type: "expense", expense: item });
    return sendSuccess(response, item, "Expense added", 201);
  }),
);
tripRouter.post(
  "/:id/expenses/settle",
  asyncHandler(async (request, response) => {
    await requireTripAccess(String(request.params.id), request.user!._id.toString());
    throw new AppError(501, "Trip expense settlement is not available yet", "NOT_IMPLEMENTED");
  }),
);
