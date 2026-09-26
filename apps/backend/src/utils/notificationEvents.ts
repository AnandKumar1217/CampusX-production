import type { Request } from "express";

// Clients refetch persisted notifications after this hint. No notification
// content is broadcast outside the recipient's authenticated user room.
export function emitNotificationChanged(request: Request, recipients: Iterable<string>) {
  const io = request.app.get("io");
  for (const userId of new Set(recipients)) {
    io?.to(`user:${userId}`).emit("notification:new", { userId });
  }
}
