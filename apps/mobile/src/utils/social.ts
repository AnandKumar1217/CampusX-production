export function resolveFriendshipState(
  targetId: string | null | undefined,
  acceptedFriends: any[],
  friendRequests: { sent?: any[]; received?: any[] } | undefined
): "none" | "outgoing_pending" | "incoming_pending" | "friends" {
  if (!targetId) return "none";

  // NORMALIZE ID
  const id = targetId.toString();

  // 1. FIRST: Check accepted friendship
  const isFriend = acceptedFriends?.some((f: any) =>
    f._id?.toString() === id || f.id?.toString() === id
  );
  if (isFriend) return "friends";

  // 2. SECOND: Check outgoing pending request
  const isSent = friendRequests?.sent?.some((r: any) =>
    r.recipient?._id?.toString() === id || r.recipient?.id?.toString() === id
  );
  if (isSent) return "outgoing_pending";

  // 3. THIRD: Check incoming pending request
  const isReceived = friendRequests?.received?.some((r: any) =>
    r.requester?._id?.toString() === id || r.requester?.id?.toString() === id
  );
  if (isReceived) return "incoming_pending";

  // ELSE
  return "none";
}
