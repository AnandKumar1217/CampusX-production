const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/commerceRoutes.ts', 'utf-8');

const startIdx = code.indexOf('export const eventRouter = Router();');
const endIdx = code.indexOf('export const marketplaceRouter = Router();');

const newEventRouter = `export const eventRouter = Router();

eventRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter: any = {
      $or: [
        { status: "active", draft: { $ne: true } },
        { creator: request.user!._id }
      ]
    };
    if (request.query.category) {
      filter.category = request.query.category;
    }
    if (request.query.q) {
      filter.$text = { $search: request.query.q };
    }
    
    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate("creator", "name username avatarUrl")
        .sort({ startsAt: 1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
    ]);
    return sendSuccess(response, { items, page, limit, total });
  }),
);

eventRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        title: z.string().min(3).max(200),
        description: z.string().max(5000),
        imageUrl: z.url().optional(),
        imagePublicId: z.string().optional(),
        category: z.string().max(80),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        location: z.object({
          name: z.string().max(200),
          coordinates: z.tuple([z.number(), z.number()]).optional(),
        }),
        capacity: z.number().min(1).optional(),
        registrationDeadline: z.coerce.date().optional(),
        status: z.enum(["draft", "active", "cancelled"]).default("active"),
        draft: z.boolean().default(false),
      })
      .parse(request.body);

    if (input.endsAt <= input.startsAt) {
      throw new AppError(400, "End time must be after start time", "INVALID_DATES");
    }
    if (input.registrationDeadline && input.registrationDeadline > input.startsAt) {
      throw new AppError(400, "Registration deadline cannot be after event starts", "INVALID_DEADLINE");
    }

    const item = await Event.create({ ...input, creator: request.user!._id });
    const io = request.app.get("io");
    if (!item.draft && item.status === "active") io?.emit("event:created", { eventId: item._id.toString() });
    
    return sendSuccess(response, item, "Event created", 201);
  }),
);

eventRouter.get(
  "/saved",
  asyncHandler(async (request, response) => {
    const saved = await SavedItem.find({ user: request.user!._id, itemType: "event" }).sort({ createdAt: -1 });
    const ids = saved.map((entry) => entry.item);
    const events = await Event.find({ _id: { $in: ids }, draft: { $ne: true } }).populate("creator", "name username avatarUrl");
    const byId = new Map(events.map((event) => [event._id.toString(), event]));
    return sendSuccess(response, ids.map((id) => byId.get(id.toString())).filter(Boolean));
  }),
);

eventRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await Event.findById(request.params.id)
      .populate("creator", "name username avatarUrl")
      .populate("attendees.user", "name username avatarUrl");
    if (!item) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if ((item.draft || item.status !== "active") && item.creator._id.toString() !== request.user!._id.toString())
      throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    return sendSuccess(response, item);
  }),
);

eventRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const input = z.object({
      title: z.string().min(3).max(200).optional(),
      description: z.string().max(5000).optional(),
      imageUrl: z.url().optional(),
      imagePublicId: z.string().optional(),
      category: z.string().max(80).optional(),
      startsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().optional(),
      location: z.object({
        name: z.string().max(200),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
      }).optional(),
      capacity: z.number().min(1).optional(),
      registrationDeadline: z.coerce.date().optional(),
      status: z.enum(["draft", "active", "cancelled"]).optional(),
      draft: z.boolean().optional(),
    }).parse(request.body);
    
    const event = await Event.findById(request.params.id);
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.creator.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized to modify this event", "FORBIDDEN");
    }
    
    const startsAt = input.startsAt || event.startsAt;
    const endsAt = input.endsAt || event.endsAt;
    if (endsAt && startsAt && endsAt <= startsAt) {
      throw new AppError(400, "End time must be after start time", "INVALID_DATES");
    }
    
    const oldPublicId = event.imagePublicId;
    const item = await Event.findByIdAndUpdate(event._id, { $set: input }, { new: true, runValidators: true });
    
    if (input.imagePublicId && oldPublicId && input.imagePublicId !== oldPublicId) {
      await cloudinaryService.deleteImage(oldPublicId).catch(console.error);
    }
    
    if (input.status === "cancelled" && event.status !== "cancelled") {
       const goingAttendees = event.attendees.filter((a: any) => a.status === "going").map((a: any) => a.user);
       if (goingAttendees.length > 0) {
           const notifs = goingAttendees.map((userId: any) => ({
               user: userId,
               actor: request.user!._id,
               type: "event_cancel",
               title: \`Event cancelled: \${event.title}\`
           }));
           await Notification.insertMany(notifs).catch(console.error);
       }
       request.app.get("io")?.emit("event:cancelled", { eventId: event._id.toString() });
    } else {
       const io = request.app.get("io");
       if (item?.draft && !event.draft) io?.emit("event:deleted", { eventId: item._id.toString() });
       else if (item?.draft) io?.to(\`user:\${request.user!._id}\`).emit("event:updated", { eventId: item._id.toString() });
       else io?.emit(event.draft ? "event:created" : "event:updated", { eventId: item?._id.toString() });
    }

    return sendSuccess(response, item, "Event updated");
  }),
);

eventRouter.post(
  "/:id/register",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id);
    if (!event || event.draft || event.status !== "active") throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    
    if (event.creator.toString() === request.user!._id.toString()) {
      throw new AppError(400, "Event owners cannot register for their own event.", "BAD_REQUEST");
    }
    
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new AppError(400, "Registration is closed for this event", "DEADLINE_PASSED");
    }
    
    const isGoing = event.attendees.some(a => a.user.toString() === request.user!._id.toString() && a.status === "going");
    if (isGoing) {
      return sendSuccess(response, null, "Already registered");
    }
    
    const goingCount = event.attendees.filter(a => a.status === "going").length;
    if (event.capacity && goingCount >= event.capacity) {
      throw new AppError(400, "Event is full", "EVENT_FULL");
    }

    await Event.updateOne(
      { _id: request.params.id },
      { $pull: { attendees: { user: request.user!._id } } }
    );
    await Event.updateOne(
      { _id: request.params.id },
      { $push: { attendees: { user: request.user!._id, status: "going", registeredAt: new Date() } } }
    );
    
    const notif = await Notification.create({
      user: event.creator,
      actor: request.user!._id,
      type: "event_join",
      title: \`\${request.user!.name} is going to your event\`,
      target: { route: "EventDetails", params: { eventId: event._id.toString() } }
    }).catch(console.error);
    if (notif) {
      void pushService.sendPushNotification(event.creator as any, {
        title: notif.title,
        body: "Tap to view",
        data: { route: "EventDetails", params: { eventId: event._id.toString() } }
      });
    }
    
    const io = request.app.get("io");
    io?.emit("event:updated", { eventId: request.params.id });
    io?.to(\`user:\${event.creator}\`).emit("event:registration_added", { eventId: request.params.id, userId: request.user!._id });
    
    return sendSuccess(response, null, "Registered successfully");
  }),
);

eventRouter.delete(
  "/:id/register",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id);
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    
    await Event.updateOne(
      { _id: request.params.id },
      { $pull: { attendees: { user: request.user!._id } } }
    );
    
    const io = request.app.get("io");
    io?.emit("event:updated", { eventId: request.params.id });
    io?.to(\`user:\${event.creator}\`).emit("event:registration_cancelled", { eventId: request.params.id, userId: request.user!._id });
    
    return sendSuccess(response, null, "Registration cancelled");
  }),
);

eventRouter.get(
  "/:id/registrations",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id).populate("attendees.user", "name username avatarUrl department year");
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.creator.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized to view registrations", "FORBIDDEN");
    }
    const going = event.attendees.filter(a => a.status === "going");
    return sendSuccess(response, going);
  }),
);

eventRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const event = await Event.findById(request.params.id);
    if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
    if (event.creator.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized to delete this event", "FORBIDDEN");
    }
    
    if (event.imagePublicId) {
       await cloudinaryService.deleteImage(event.imagePublicId).catch(console.error);
    }
    await event.deleteOne();
    await SavedItem.deleteMany({ itemType: "event", item: event._id });
    
    const io = request.app.get("io");
    if (event.draft) io?.to(\`user:\${request.user!._id}\`).emit("event:deleted", { eventId: request.params.id });
    else io?.emit("event:deleted", { eventId: request.params.id });

    return sendSuccess(response, null, "Event deleted");
  }),
);

eventRouter.post(
  "/:id/save",
  asyncHandler(async (request, response) => {
    const { saved } = z.object({ saved: z.boolean() }).parse(request.body);
    const filter = { user: request.user!._id, itemType: "event", item: request.params.id };
    if (saved) {
      const event = await Event.exists({ _id: request.params.id, draft: { $ne: true } });
      if (!event) throw new AppError(404, "Event not found", "EVENT_NOT_FOUND");
      await SavedItem.findOneAndUpdate(filter, filter, { upsert: true });
    } else {
      await SavedItem.findOneAndDelete(filter);
    }
    return sendSuccess(response, { saved });
  }),
);

`;

code = code.substring(0, startIdx) + newEventRouter + code.substring(endIdx);
fs.writeFileSync('apps/backend/src/routes/commerceRoutes.ts', code);
